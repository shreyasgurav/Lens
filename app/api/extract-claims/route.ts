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
  contactEmail?: string;
  reason: string;
  causalEvidence: { simulationsAppeared: number; competitorsPresent: string[]; claimsReinforced: string[]; };
  confidence: ConfidenceScore;
  priority: 'critical' | 'high' | 'medium';
  actions: string[];
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

    // STEP 7: Generate outreach
    console.log(`\n=== STEP 7: Building outreach from ${observations.length} observations ===`);
    const sourceAuth = new Map<string, { domain: string; sims: Set<number>; comps: Set<string>; claims: Set<string>; type: string }>();
    for (const obs of observations) {
      if (!obs.sourceDomain) continue;
      if (!sourceAuth.has(obs.sourceDomain)) sourceAuth.set(obs.sourceDomain, { domain: obs.sourceDomain, sims: new Set(), comps: new Set(), claims: new Set(), type: classifySourceType(obs.sourceDomain) });
      const entry = sourceAuth.get(obs.sourceDomain)!;
      entry.sims.add(obs.promptIndex);
      const isYours = obs.brand.toLowerCase() === yourBrand;
      if (!isYours) entry.comps.add(obs.brand);
    }
    
    console.log(`Total sources found: ${sourceAuth.size}`);
    const outreachRecommendations: OutreachRecommendation[] = [];
    const actionableTypes = ['review_site', 'publication', 'directory', 'community'];
    sourceAuth.forEach(source => {
      const isActionableType = actionableTypes.includes(source.type);
      const meetsSimThreshold = source.sims.size >= THRESHOLDS.MIN_OUTREACH_SIMULATIONS;
      const meetsCompThreshold = source.comps.size >= THRESHOLDS.MIN_OUTREACH_COMPETITORS;
      
      console.log(`Source: ${source.domain}`);
      console.log(`  Type: ${source.type} (actionable: ${isActionableType})`);
      console.log(`  Simulations: ${source.sims.size} >= ${THRESHOLDS.MIN_OUTREACH_SIMULATIONS}? ${meetsSimThreshold}`);
      console.log(`  Competitors: ${source.comps.size} >= ${THRESHOLDS.MIN_OUTREACH_COMPETITORS}? ${meetsCompThreshold}`);
      
      if (isActionableType && meetsSimThreshold && meetsCompThreshold) {
        console.log(`  ✅ OUTREACH CANDIDATE`);
        const conf = { promptConfidence: Math.min(100, (source.sims.size / totalPrompts) * 300), sourceConfidence: source.type === 'review_site' ? 90 : 60, competitivePressure: Math.min(100, source.comps.size * 30), final: 0, explanation: '' };
        conf.final = Math.round(0.4 * conf.promptConfidence + 0.35 * conf.sourceConfidence + 0.25 * conf.competitivePressure);
        conf.explanation = `Cited in ${source.sims.size} simulations with ${source.comps.size} competitors`;
        
        outreachRecommendations.push({
          id: `outreach-${outreachRecommendations.length}`,
          type: source.type as any,
          platform: source.domain,
          url: `https://${source.domain}`,
          contactEmail: generateContactEmail(source.domain, source.type),
          reason: `Cited ${source.sims.size}× across simulations. ${Array.from(source.comps).slice(0, 2).join(', ')} are present here.`,
          causalEvidence: { simulationsAppeared: source.sims.size, competitorsPresent: Array.from(source.comps), claimsReinforced: [] },
          confidence: conf,
          priority: conf.final >= 60 ? 'critical' : conf.final >= 40 ? 'high' : 'medium',
          actions: generateActions(source.type, source.domain, companyName),
        });
      } else {
        console.log(`  ❌ FILTERED OUT`);
      }
    });
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

function generateContactEmail(domain: string, type: string): string {
  // Common contact patterns for different source types
  const baseDomain = domain.replace(/^www\./, '');
  
  if (type === 'review_site') {
    // Review sites often have partnerships/business emails
    return `partnerships@${baseDomain}`;
  } else if (type === 'publication') {
    // Publications typically use editorial/tips emails
    return `editorial@${baseDomain}`;
  } else if (type === 'directory') {
    // Directories use submissions/listings emails
    return `submit@${baseDomain}`;
  } else if (type === 'community') {
    // Communities use hello/contact
    return `hello@${baseDomain}`;
  }
  
  // Default fallback
  return `contact@${baseDomain}`;
}

function generateActions(type: string, domain: string, brand: string): string[] {
  if (type === 'review_site') return [`Claim ${brand} profile on ${domain}`, 'Complete product description', 'Launch review campaign'];
  if (type === 'publication') return ['Pitch guest article', 'Offer founder interview', 'Share newsworthy updates'];
  if (type === 'directory') return [`Submit ${brand} to ${domain}`, 'Optimize listing', 'Encourage upvotes'];
  return [`Build presence on ${domain}`, 'Answer relevant questions', 'Share valuable content'];
}
