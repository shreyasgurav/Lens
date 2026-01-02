import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TYPES - Production-grade causal recommendation engine
// ============================================================================

type ClaimType = 'differentiator' | 'table_stakes' | 'disqualifier';

interface Observation {
  prompt: string;
  promptIndex: number;
  brand: string;
  rank: number | null;
  source: string | null;
  sourceDomain: string | null;
  contentType: 'list' | 'comparison' | 'review' | 'general';
}

interface ClaimObservation {
  claim: string;
  brand: string;
  prompt: string;
  promptIndex: number;
  source: string | null;
}

interface CanonicalClaim {
  id: string;
  label: string;
  variants: string[];
  claimType: ClaimType;
}

interface TriangulatedClaim {
  canonicalId: string;
  label: string;
  claimType: ClaimType;
  promptSupport: number;
  sourceSupport: number;
  competitorSupport: number;
  yourBrandSupport: number;
  prompts: { query: string; index: number; promptType: 'high_intent' | 'comparison' | 'discovery' | 'general'; }[];
  sources: { domain: string; url: string; citationCount: number; sourceType: string; }[];
  competitors: { brand: string; mentions: number; avgRank: number; }[];
  totalMentions: number;
}

interface ConfidenceScore {
  promptConfidence: number;
  sourceConfidence: number;
  competitivePressure: number;
  final: number;
  explanation: string;
}

interface ContentRecommendation {
  id: string;
  missingClaim: string;
  claimType: ClaimType;
  confidence: ConfidenceScore;
  causalEvidence: { promptsAffected: number; highIntentPrompts: number; sourceDomains: number; topCompetitor: string; topCompetitorMentions: number; };
  whyAISaysThis: string;
  evidenceSummary: string;
  triangulation: { prompts: string[]; sources: string[]; competitors: string[]; };
  recommendedContent: { type: 'blog' | 'comparison' | 'use_case_page'; title: string; outline: string[]; reason: string; }[];
  priority: 'critical' | 'high' | 'medium' | 'weak_signal';
}

interface OutreachRecommendation {
  id: string;
  type: 'review_site' | 'publication' | 'directory' | 'community';
  platform: string;
  url: string;
  contactEmail: string;
  contactConfidence: 'high' | 'medium' | 'low';
  contactSource: 'ai_discovered' | 'pattern' | 'contact_page';
  subject: string;
  emailBody: string;
  claimToEstablish: string;
  competitorsReinforcing: string[];
  confidence: ConfidenceScore;
  priority: 'critical' | 'high' | 'medium';
  completed?: boolean;
}

const THRESHOLDS = {
  MIN_PROMPT_SUPPORT: 1,         // Lowered to 1 - with only 3 simulations, claims rarely appear 2+ times
  MIN_SOURCE_SUPPORT: 1,         // Lowered to 1 - need at least 1 source to be grounded
  MIN_COMPETITOR_SUPPORT: 1,
  MIN_OUTREACH_SIMULATIONS: 1,
  MIN_OUTREACH_COMPETITORS: 1,
  MAX_CONTENT_RECOMMENDATIONS: 5,
  MAX_OUTREACH_RECOMMENDATIONS: 5,
};

export async function POST(request: NextRequest) {
  try {
    const { simulationResults, companyName, competitors } = await request.json();
    if (!simulationResults || !companyName) {
      return NextResponse.json({ success: false, error: "Missing data" }, { status: 400 });
    }

    const yourBrand = companyName.toLowerCase();
    const totalPrompts = simulationResults.length;
    console.log('=== EXTRACT CLAIMS V2 ===', { companyName, totalPrompts });

    // STEP 1: Build observations
    const observations: Observation[] = [];
    for (let i = 0; i < simulationResults.length; i++) {
      const result = simulationResults[i];
      const sources = result.sources || [];
      const contentType = classifyContentType(result.query);
      
      for (const brand of (result.mentionedBrands || [])) {
        if (sources.length > 0) {
          for (const source of sources) {
            try {
              const domain = new URL(source.url).hostname.replace('www.', '');
              observations.push({ prompt: result.query, promptIndex: i, brand: brand.name, rank: brand.position, source: source.url, sourceDomain: domain, contentType });
            } catch {}
          }
        } else {
          observations.push({ prompt: result.query, promptIndex: i, brand: brand.name, rank: brand.position, source: null, sourceDomain: null, contentType });
        }
      }
    }

    // STEP 2: Extract claims
    const claimObservations: ClaimObservation[] = [];
    for (let i = 0; i < simulationResults.length; i++) {
      const result = simulationResults[i];
      if (!result.response || result.response.length < 50) continue;
      
      const sourceUrl = result.sources?.length > 0 ? result.sources[0].url : null;
      
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Extract WHY AI recommends products (reasons), not WHAT features they have. Max 3 claims per brand." },
            { role: "user", content: `Query: "${result.query}"\nResponse: "${result.response?.substring(0, 2000)}"\n\nExtract claims as JSON: [{"brand": "X", "claim": "reason AI recommends", "claimType": "differentiator|table_stakes|disqualifier"}]` }
          ],
          temperature: 0.1,
          max_tokens: 800,
        });

        const content = completion.choices[0].message.content || "[]";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const claims = JSON.parse(jsonMatch[0]);
          claims.forEach((c: any) => {
            if (c.claim?.length >= 10) {
              claimObservations.push({ claim: c.claim.toLowerCase().trim(), brand: c.brand, prompt: result.query, promptIndex: i, source: sourceUrl });
            }
          });
        }
      } catch (e) { console.error("Claim error", i, e); }
    }

    // STEP 3: Canonicalize claims
    const uniqueClaims = [...new Set(claimObservations.map(c => c.claim))];
    const canonicalClaims: CanonicalClaim[] = uniqueClaims.slice(0, 20).map((claim, i) => ({
      id: `claim-${i}`,
      label: claim,
      variants: [claim],
      claimType: inferClaimType(claim),
    }));

    // STEP 4: Triangulate
    const triangulatedClaims = new Map<string, TriangulatedClaim>();
    for (const canonical of canonicalClaims) {
      const matching = claimObservations.filter(co => co.claim === canonical.label);
      if (matching.length === 0) continue;
      
      const uniquePrompts = new Set(matching.map(o => o.promptIndex));
      const uniqueSources = new Set(matching.map(o => o.source).filter(Boolean));
      
      const competitorMap = new Map<string, { mentions: number; ranks: number[] }>();
      let yourBrandMentions = 0;
      
      for (const obs of matching) {
        const brandLower = obs.brand.toLowerCase();
        const isYours = brandLower === yourBrand || brandLower.includes(yourBrand) || yourBrand.includes(brandLower);
        if (isYours) { yourBrandMentions++; }
        else {
          const existing = competitorMap.get(obs.brand) || { mentions: 0, ranks: [] };
          existing.mentions++;
          const matchObs = observations.find(o => o.promptIndex === obs.promptIndex && o.brand.toLowerCase() === brandLower);
          if (matchObs?.rank) existing.ranks.push(matchObs.rank);
          competitorMap.set(obs.brand, existing);
        }
      }
      
      const competitorsList = Array.from(competitorMap.entries()).map(([brand, data]) => ({
        brand, mentions: data.mentions, avgRank: data.ranks.length > 0 ? data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length : 99,
      }));
      
      const sourcesList = Array.from(new Set(matching.map(o => o.source).filter(Boolean))).map(url => {
        try { const domain = new URL(url!).hostname.replace('www.', ''); return { domain, url: url!, citationCount: 1, sourceType: classifySourceType(domain) }; } catch { return null; }
      }).filter(Boolean) as TriangulatedClaim['sources'];
      
      const promptsList = Array.from(uniquePrompts).map(idx => {
        const obs = matching.find(o => o.promptIndex === idx)!;
        return { query: obs.prompt, index: idx, promptType: classifyPromptType(obs.prompt) };
      });
      
      triangulatedClaims.set(canonical.id, {
        canonicalId: canonical.id, label: canonical.label, claimType: canonical.claimType,
        promptSupport: uniquePrompts.size, sourceSupport: uniqueSources.size, competitorSupport: competitorMap.size, yourBrandSupport: yourBrandMentions,
        prompts: promptsList, sources: sourcesList, competitors: competitorsList, totalMentions: matching.length,
      });
    }

    // STEP 5: Filter actionable
    const actionableClaims: TriangulatedClaim[] = [];
    console.log(`\n=== STEP 5: Filtering ${triangulatedClaims.size} claims ===`);
    triangulatedClaims.forEach(claim => {
      const meetsPrompt = claim.promptSupport >= THRESHOLDS.MIN_PROMPT_SUPPORT;
      const meetsSource = claim.sourceSupport >= THRESHOLDS.MIN_SOURCE_SUPPORT;
      const meetsCompetitor = claim.competitorSupport >= THRESHOLDS.MIN_COMPETITOR_SUPPORT;
      const notYours = claim.yourBrandSupport === 0;
      
      console.log(`Claim: "${claim.label.substring(0, 50)}..."`);
      console.log(`  Prompt: ${claim.promptSupport} >= ${THRESHOLDS.MIN_PROMPT_SUPPORT}? ${meetsPrompt}`);
      console.log(`  Source: ${claim.sourceSupport} >= ${THRESHOLDS.MIN_SOURCE_SUPPORT}? ${meetsSource}`);
      console.log(`  Competitor: ${claim.competitorSupport} >= ${THRESHOLDS.MIN_COMPETITOR_SUPPORT}? ${meetsCompetitor}`);
      console.log(`  Not yours: ${notYours}`);
      
      if (meetsPrompt && meetsSource && meetsCompetitor && notYours) {
        actionableClaims.push(claim);
        console.log(`  ✅ ACTIONABLE`);
      } else {
        console.log(`  ❌ FILTERED OUT`);
      }
    });
    console.log(`\nActionable claims: ${actionableClaims.length}`);
    actionableClaims.sort((a, b) => { const order = { differentiator: 3, table_stakes: 2, disqualifier: 1 }; return (order[b.claimType] || 0) - (order[a.claimType] || 0); });

    // STEP 6: Generate content
    const contentRecommendations: ContentRecommendation[] = [];
    const topClaims = actionableClaims.slice(0, THRESHOLDS.MAX_CONTENT_RECOMMENDATIONS);
    
    for (let i = 0; i < topClaims.length; i++) {
      const claim = topClaims[i];
      const topComp = claim.competitors.sort((a, b) => b.mentions - a.mentions)[0];
      const highIntent = claim.prompts.filter(p => p.promptType === 'high_intent' || p.promptType === 'comparison').length;
      const confidence = calculateConfidence(claim, totalPrompts);
      
      contentRecommendations.push({
        id: `content-${i}`,
        missingClaim: claim.label,
        claimType: claim.claimType,
        confidence,
        causalEvidence: { promptsAffected: claim.promptSupport, highIntentPrompts: highIntent, sourceDomains: claim.sourceSupport, topCompetitor: topComp?.brand || 'competitors', topCompetitorMentions: topComp?.mentions || 0 },
        whyAISaysThis: `AI associates "${claim.label}" with ${topComp?.brand || 'competitors'} because ${claim.sourceSupport} sources reinforce this. You're missing because no sources make this claim about you.`,
        evidenceSummary: `${Math.round((claim.promptSupport / totalPrompts) * 100)}% of prompts • ${claim.sourceSupport} sources • ${topComp?.brand} mentioned ${topComp?.mentions}×`,
        triangulation: { prompts: claim.prompts.slice(0, 5).map(p => p.query), sources: claim.sources.slice(0, 5).map(s => s.domain), competitors: claim.competitors.slice(0, 3).map(c => c.brand) },
        recommendedContent: generateContent(claim, companyName, topComp),
        priority: confidence.final >= 60 ? 'critical' : confidence.final >= 40 ? 'high' : confidence.final >= 20 ? 'medium' : 'weak_signal',
      });
    }

    // STEP 7: Claim-driven outreach with AI-written emails
    console.log(`\n=== STEP 7: Generating claim-driven outreach emails ===`);
    const outreachRecommendations: OutreachRecommendation[] = [];
    const actionableTypes = ['review_site', 'publication', 'directory', 'community'];

    for (const claim of actionableClaims) {
      const claimConfidence = calculateConfidence(claim, totalPrompts);
      if (claimConfidence.final < 40) continue; // Filter out weak outreach

      for (const source of claim.sources) {
        const sourceType = classifySourceType(source.domain);
        if (!actionableTypes.includes(sourceType)) continue;

        const competitors = claim.competitors
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 3)
          .map(c => c.brand);

        if (!competitors.length) continue;

        console.log(`Generating outreach for ${source.domain} (${sourceType}) - Claim: "${claim.label.substring(0, 50)}..."`);

        // 1. Discover contact with confidence
        const contact = await discoverContact(source.domain, sourceType);
        
        // 2. Generate claim-first subject line
        const subject = generateEmailSubject(claim.label, source.domain, sourceType);
        
        // 3. Generate LLM-written email body
        const emailBody = await generateOutreachEmail({
          brand: companyName,
          platform: source.domain,
          claim: claim.label,
          competitors,
          sourceType,
        });

        outreachRecommendations.push({
          id: `outreach-${outreachRecommendations.length}`,
          type: sourceType as any,
          platform: source.domain,
          url: source.url || `https://${source.domain}`,
          contactEmail: contact.email,
          contactConfidence: contact.confidence,
          contactSource: contact.source,
          subject,
          emailBody,
          claimToEstablish: claim.label,
          competitorsReinforcing: competitors,
          confidence: claimConfidence,
          priority:
            claimConfidence.final >= 65 ? 'critical' :
            claimConfidence.final >= 45 ? 'high' : 'medium',
        });
      }
    }

    outreachRecommendations.sort((a, b) => b.confidence.final - a.confidence.final);

    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Content recommendations: ${contentRecommendations.length}`);
    console.log(`Outreach recommendations: ${outreachRecommendations.length}`);

    return NextResponse.json({
      success: true,
      stats: { totalPrompts, observations: observations.length, claims: claimObservations.length, actionable: actionableClaims.length },
      contentRecommendations,
      outreachRecommendations: outreachRecommendations.slice(0, THRESHOLDS.MAX_OUTREACH_RECOMMENDATIONS),
    });
  } catch (error) {
    console.error("Extract claims error:", error);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

function classifyPromptType(q: string): 'high_intent' | 'comparison' | 'discovery' | 'general' {
  const l = q.toLowerCase();
  if (l.includes('best') || l.includes('top') || l.includes('recommend')) return 'high_intent';
  if (l.includes(' vs ') || l.includes('alternative') || l.includes('compare')) return 'comparison';
  if (l.includes('what is') || l.includes('how does')) return 'discovery';
  return 'general';
}

function classifyContentType(q: string): 'list' | 'comparison' | 'review' | 'general' {
  const l = q.toLowerCase();
  if (l.includes('best') || l.includes('top')) return 'list';
  if (l.includes(' vs ') || l.includes('compare')) return 'comparison';
  return 'general';
}

function classifySourceType(d: string): string {
  const l = d.toLowerCase();
  
  // Review sites
  if (['g2.com', 'capterra.com', 'trustradius.com', 'getapp.com', 'softwareadvice.com', 'trustpilot.com'].some(s => l.includes(s))) return 'review_site';
  
  // Publications & blogs (broader definition)
  if (['techcrunch.com', 'forbes.com', 'wired.com', 'theverge.com', 'venturebeat.com', 'zdnet.com', 'cnet.com', 'lifewire.com', 'thebrandhopper.com', 'aiapps.com', 'reelmind.ai'].some(s => l.includes(s))) return 'publication';
  
  // Directories & comparison sites
  if (['producthunt.com', 'alternativeto.net', 'slant.co', 'stackshare.io', 'saasworthy.com', 'zapier.com', 'appliedai.tools', 'votars.ai'].some(s => l.includes(s))) return 'directory';
  
  // Communities
  if (['reddit.com', 'medium.com', 'quora.com', 'dev.to', 'stackoverflow.com'].some(s => l.includes(s))) return 'community';
  
  // Official product sites and documentation (treat as publication for outreach purposes)
  if (l.includes('blog') || l.includes('news') || l.includes('help') || l.includes('support') || l.includes('docs')) return 'publication';
  
  return 'other';
}

function inferClaimType(c: string): ClaimType {
  const l = c.toLowerCase();
  if (l.includes('expensive') || l.includes('complex') || l.includes('limited')) return 'disqualifier';
  if (l.includes('best') || l.includes('only') || l.includes('leading')) return 'differentiator';
  return 'table_stakes';
}

function calculateConfidence(claim: TriangulatedClaim, total: number): ConfidenceScore {
  const prompt = Math.min(100, (claim.promptSupport / total) * 200);
  const source = Math.min(100, claim.sourceSupport * 20);
  const competitive = Math.min(100, claim.competitors.reduce((s, c) => s + c.mentions, 0) * 20);
  const final = Math.round(0.4 * prompt + 0.35 * source + 0.25 * competitive);
  return { promptConfidence: Math.round(prompt), sourceConfidence: Math.round(source), competitivePressure: Math.round(competitive), final, explanation: `${claim.promptSupport} prompts, ${claim.sourceSupport} sources, ${claim.competitors.length} competitors` };
}

function generateContent(claim: TriangulatedClaim, brand: string, top: { brand: string; mentions: number } | undefined): ContentRecommendation['recommendedContent'] {
  const label = claim.label.charAt(0).toUpperCase() + claim.label.slice(1);
  const topCompetitor = top?.brand || claim.competitors[0]?.brand || 'Alternatives';
  const content: ContentRecommendation['recommendedContent'] = [];
  
  // Generate claim-first, declarative H1 title
  let h1Title: string;
  let contentType: 'blog' | 'comparison' | 'use_case_page' = 'blog';
  let reason: string;
  
  if (claim.claimType === 'differentiator') {
    // Differentiator: Declarative claim about what brand offers
    h1Title = `${brand} offers ${claim.label.toLowerCase()}`;
    contentType = 'comparison';
    reason = 'Differentiator owned by competitor - comparison blog captures decision criteria for AI citation';
  } else if (claim.claimType === 'table_stakes') {
    // Table stakes: Declarative claim about capability
    h1Title = `${brand} provides ${claim.label.toLowerCase()}`;
    contentType = 'use_case_page';
    reason = 'Missing table stakes claim - use case page establishes capability for AI systems';
  } else {
    // Disqualifier: Declarative claim addressing the concern
    h1Title = `${brand} handles ${claim.label.toLowerCase()} effectively`;
    contentType = 'blog';
    reason = 'Disqualifier claim - objection-handling blog addresses concerns AI systems surface';
  }
  
  // Build structured outline optimized for LLM citation
  // Note: After H1, include AI summary sentence: "This article explains why {Brand} is recommended when {claim} matters."
  // Note: Intro paragraph (2-3 sentences) comes after H1 and AI summary sentence, before first section
  const outline: string[] = [
    // 1. H1 title (declarative claim) - set above
    // 2. AI summary sentence: "This article explains why {Brand} is recommended when {claim} matters." (content guidance, not a heading)
    // 3. Intro paragraph (2-3 sentences) - content guidance, not a heading
    // 4. At a glance section (bullets: Problem, What most tools do, What brand does differently, Best for)
    `At a glance: ${claim.label}`,
    // 5. Comparison section (decision criteria, not feature lists)
    `How ${brand} compares to ${topCompetitor}`,
    // 6. When to choose section (conditional logic bullets)
    `When to choose ${brand}`,
    // 7. Why AI recommends section (matches AI's internal reasoning language)
    'Why AI recommends this',
  ];
  
  // Add optional "Switching from" section for differentiator/comparison content
  if (claim.claimType === 'differentiator' && top?.brand) {
    outline.push(`Switching from ${top.brand}`);
  }
  
  content.push({
    type: contentType,
    title: h1Title,
    outline: outline,
    reason: reason
  });
  
  return content;
}

interface ContactDiscovery {
  email: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'ai_discovered' | 'pattern' | 'contact_page';
}

async function discoverContact(domain: string, type: string): Promise<ContactDiscovery> {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content: `You find public outreach contacts for websites.

RULES:
- Only return emails you are confident exist (e.g., from common patterns for known sites)
- If unsure, say "CONTACT_PAGE"
- Never invent emails
- Format: EMAIL: address@domain.com OR CONTACT_PAGE`
        },
        {
          role: 'user',
          content: `Website: ${domain}
Type: ${type}

Find the most appropriate public contact email for ${type === 'publication' ? 'editorial/contributor inquiries' : type === 'review_site' ? 'business partnerships' : type === 'directory' ? 'listing submissions' : 'general contact'}.`
        }
      ]
    });

    const text = res.choices[0].message.content?.trim() || '';
    
    // Check if AI found a real email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !text.includes('CONTACT_PAGE')) {
      return {
        email: emailMatch[1],
        confidence: 'high',
        source: 'ai_discovered'
      };
    }

    // AI said contact page - return URL with low confidence
    if (text.includes('CONTACT_PAGE') || !emailMatch) {
      return {
        email: `https://${domain}/contact`,
        confidence: 'low',
        source: 'contact_page'
      };
    }

    return {
      email: `https://${domain}/contact`,
      confidence: 'low',
      source: 'contact_page'
    };
  } catch (error) {
    console.error(`Error discovering contact for ${domain}:`, error);
    // Fallback to deterministic patterns - medium confidence
    const baseDomain = domain.replace(/^www\./, '');
    let email: string;
    
    if (type === 'review_site') {
      email = `partnerships@${baseDomain}`;
    } else if (type === 'publication') {
      email = `editorial@${baseDomain}`;
    } else if (type === 'directory') {
      email = `submit@${baseDomain}`;
    } else if (type === 'community') {
      email = `hello@${baseDomain}`;
    } else {
      email = `https://${domain}/contact`;
      return { email, confidence: 'low', source: 'contact_page' };
    }
    
    return {
      email,
      confidence: 'medium',
      source: 'pattern'
    };
  }
}

function generateEmailSubject(claim: string, platform: string, type: string): string {
  // Claim-first, deterministic subject lines based on source type
  const shortClaim = claim.length > 50 ? claim.substring(0, 50) + '...' : claim;
  
  if (type === 'publication') {
    return `Inclusion request: ${shortClaim}`;
  } else if (type === 'review_site') {
    return `Coverage update: ${shortClaim}`;
  } else if (type === 'directory') {
    return `Listing request: ${shortClaim}`;
  } else {
    return `Context for ${shortClaim} coverage on ${platform}`;
  }
}

async function generateOutreachEmail({ 
  brand, 
  platform, 
  claim, 
  competitors,
  sourceType 
}: { 
  brand: string; 
  platform: string; 
  claim: string; 
  competitors: string[];
  sourceType: string;
}): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        {
          role: 'system',
          content: `You write neutral, professional outreach emails to editors and content managers.

ABSOLUTE RULES:
- 4-6 sentences maximum
- Neutral, factual tone
- No marketing language
- No begging or desperation
- No exaggeration
- No "I hope this finds you well"
- No CTAs like "Let me know if..."
- Short sentences only

STRUCTURE:
1. State WHY this site matters (AI cites it)
2. State WHAT competitors are already covered
3. State WHAT your brand does (same criteria)
4. State WHY inclusion makes sense (factual relevance)
5. Simple sign-off

GOAL:
Request inclusion based on factual relevance, not persuasion.`
        },
        {
          role: 'user',
          content: `Platform: ${platform} (${sourceType})
Claim being discussed: "${claim}"
Competitors already cited: ${competitors.join(', ')}
Brand requesting inclusion: ${brand}

Write the outreach email body only (no subject line, no greeting like "Dear Editor").
Start directly with the content.`
        }
      ]
    });

    const emailBody = completion.choices[0].message.content?.trim();
    
    if (emailBody) {
      return `Hi there,\n\n${emailBody}\n\nBest,\n${brand}`;
    }
    
    // Fallback to template if LLM fails
    return generateFallbackEmail(brand, platform, claim, competitors);
  } catch (error) {
    console.error(`Error generating outreach email:`, error);
    return generateFallbackEmail(brand, platform, claim, competitors);
  }
}

function generateFallbackEmail(brand: string, platform: string, claim: string, competitors: string[]): string {
  return `Hi there,

AI assistants frequently reference ${platform} when users ask about "${claim}".

In those responses, ${competitors.join(', ')} are commonly cited. ${brand} addresses the same decision criteria but is not currently represented.

We can provide neutral, factual context for your coverage.

Best,
${brand}`;
}

function generateActions(type: string, domain: string, brand: string): string[] {
  if (type === 'review_site') return [`Claim ${brand} profile on ${domain}`, 'Complete product description', 'Launch review campaign'];
  if (type === 'publication') return ['Pitch guest article', 'Offer founder interview', 'Share newsworthy updates'];
  if (type === 'directory') return [`Submit ${brand} to ${domain}`, 'Optimize listing', 'Encourage upvotes'];
  return [`Build presence on ${domain}`, 'Answer relevant questions', 'Share valuable content'];
}
