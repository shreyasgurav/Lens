import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TYPES - Production-grade claim intelligence
// ============================================================================

type ClaimType = 'differentiator' | 'table_stakes' | 'disqualifier';

interface ExtractedClaim {
  brand: string;
  claim: string;
  claimType: ClaimType;
  promptIndex: number;
  query: string;
  sources: string[];
}

// The MAGIC structure: Claim → Source → Prompt triangulation
interface TriangulatedClaim {
  claim: string;
  claimType: ClaimType;
  prompts: {
    query: string;
    index: number;
    promptType: 'high_intent' | 'comparison' | 'discovery' | 'general';
  }[];
  sources: {
    domain: string;
    url: string;
    citationCount: number;
    sourceType: 'review_site' | 'publication' | 'comparison' | 'blog' | 'official' | 'other';
  }[];
  competitors: { brand: string; mentions: number }[];
  yourBrandMentions: number;
  totalMentions: number;
}

interface ContentRecommendation {
  id: string;
  missingClaim: string;
  claimType: ClaimType;
  // CAUSAL evidence - the magic sentence
  causalEvidence: {
    promptPercentage: number;
    highIntentPrompts: number;
    totalPromptsAffected: number;
    reinforcingSources: number;
    sourceTypes: string[];
    topCompetitor: string;
    topCompetitorMentions: number;
  };
  // Human-readable evidence
  evidenceSummary: string;
  whyAISaysThis: string;
  impactScore: number;
  competitorMentions: { brand: string; count: number }[];
  triangulation: {
    prompts: string[];
    sources: string[];
  };
  recommendedContent: {
    type: 'blog' | 'page' | 'comparison' | 'case_study';
    title: string;
    outline: string[];
    reason: string;
    expectedImpact: string;
  }[];
  priority: 'critical' | 'high' | 'medium';
}

interface OutreachRecommendation {
  id: string;
  type: 'review_site' | 'publication' | 'directory' | 'community';
  platform: string;
  url?: string;
  reason: string;
  causalEvidence: {
    citationCount: number;
    promptsAffected: number;
    competitorsPresent: number;
    claimsReinforced: string[];
  };
  competitorPresence: string[];
  priority: 'critical' | 'high' | 'medium';
  actions: string[];
  authorityScore: number;
}

// ============================================================================
// THRESHOLDS - Minimum requirements for actionability
// ============================================================================

const THRESHOLDS = {
  MIN_CLAIM_FREQUENCY: 1,        // Claim must appear 1+ times (lowered for faster results)
  MIN_SOURCE_CITATIONS: 1,       // Source must be cited 1+ times (lowered for faster results)
  MAX_CONTENT_RECOMMENDATIONS: 5, // Limit to 5 key blog recommendations
  MIN_PROMPT_IMPACT: 10,         // Must affect 10%+ of prompts for critical
  HIGH_INTENT_MULTIPLIER: 2.5,   // High-intent prompts count 2.5x
  AUTHORITY_SOURCE_BOOST: 1.5,   // Boost for authoritative sources
};

// ============================================================================
// MAIN API
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { simulationResults, companyName, competitors, description } = await request.json();

    if (!simulationResults || !companyName) {
      return NextResponse.json({ success: false, error: "Missing required data" }, { status: 400 });
    }

    const yourBrand = companyName.toLowerCase();
    const competitorNames = (competitors?.map((c: any) => c.name.toLowerCase()) || []) as string[];
    const totalPrompts = simulationResults.length;

    console.log('=== EXTRACT CLAIMS START ===');
    console.log('Company:', companyName);
    console.log('Your brand (normalized):', yourBrand);
    console.log('Total prompts:', totalPrompts);
    console.log('Competitors:', competitorNames);

    // ========================================================================
    // STEP 1: Extract claims WITH classification and source tracking
    // ========================================================================
    
    const extractedClaims: ExtractedClaim[] = [];
    
    for (let i = 0; i < simulationResults.length; i++) {
      const result = simulationResults[i];
      // Sources are in the simulation result - extract URLs
      const sources = result.sources?.map((s: any) => s.url).filter(Boolean) || [];
      
      console.log(`Prompt ${i}: "${result.query}"`);
      console.log(`  Sources found: ${sources.length}`);
      console.log(`  Response length: ${result.response?.length || 0}`);
      
      const extractionPrompt = `Analyze this AI response and extract CLAIMS about each brand mentioned.

QUERY: "${result.query}"

AI RESPONSE:
"${result.response?.substring(0, 2000) || 'No response'}"

For each brand mentioned, extract claims and classify them:

CLAIM TYPES:
1. DIFFERENTIATOR - Unique competitive advantage (e.g., "fastest delivery", "only one with X feature", "best for enterprise")
2. TABLE_STAKES - Expected feature everyone should have (e.g., "easy to use", "good support", "reliable")
3. DISQUALIFIER - Deal-breaker when missing (e.g., "expensive", "limited integration", "steep learning curve")

Return JSON array:
[
  {
    "brand": "BrandName",
    "claim": "specific claim text",
    "claimType": "differentiator" | "table_stakes" | "disqualifier"
  }
]

RULES:
- Claims must be SPECIFIC (not "is good" or "is popular")
- Claims must be COMPARATIVE or DESCRIPTIVE (how AI positions the brand)
- Include negative claims as disqualifiers
- Be precise about what makes something a differentiator vs table stakes

Return ONLY valid JSON array.`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "You are an expert at analyzing AI responses to extract and classify brand claims. You understand that AI recommendations are based on repeated patterns across sources, not random opinions. Extract claims precisely and classify them correctly." 
            },
            { role: "user", content: extractionPrompt }
          ],
          temperature: 0.2,
          max_tokens: 1500,
        });

        const content = completion.choices[0].message.content || "[]";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const claims = JSON.parse(jsonMatch[0]) as { brand: string; claim: string; claimType: ClaimType }[];
          claims.forEach(c => {
            if (c.claim && c.claim.length >= 5) {
              extractedClaims.push({
                brand: c.brand,
                claim: c.claim.toLowerCase().trim(),
                claimType: c.claimType || 'table_stakes',
                promptIndex: i,
                query: result.query,
                sources,
              });
            }
          });
        }
      } catch (e) {
        console.error("Claim extraction error for prompt", i, e);
      }
    }

    console.log('Total extracted claims:', extractedClaims.length);
    console.log('Sample claims:', extractedClaims.slice(0, 5).map(c => ({ brand: c.brand, claim: c.claim, type: c.claimType })));

    // ========================================================================
    // STEP 2: Build TRIANGULATED claim map (Claim → Source → Prompt)
    // ========================================================================
    
    const triangulatedClaims = new Map<string, TriangulatedClaim>();
    
    extractedClaims.forEach(ec => {
      const claimKey = ec.claim;
      const brandLower = ec.brand.toLowerCase();
      const isYourBrand = brandLower === yourBrand || 
                          brandLower.includes(yourBrand) || 
                          yourBrand.includes(brandLower);
      
      if (!triangulatedClaims.has(claimKey)) {
        triangulatedClaims.set(claimKey, {
          claim: ec.claim,
          claimType: ec.claimType,
          prompts: [],
          sources: [],
          competitors: [],
          yourBrandMentions: 0,
          totalMentions: 0,
        });
      }
      
      const entry = triangulatedClaims.get(claimKey)!;
      entry.totalMentions++;
      
      // Track prompts
      const promptType = classifyPromptType(ec.query);
      if (!entry.prompts.find(p => p.index === ec.promptIndex)) {
        entry.prompts.push({
          query: ec.query,
          index: ec.promptIndex,
          promptType,
        });
      }
      
      // Track sources
      ec.sources.forEach(sourceUrl => {
        try {
          const domain = new URL(sourceUrl).hostname.replace('www.', '');
          const existing = entry.sources.find(s => s.domain === domain);
          if (existing) {
            existing.citationCount++;
          } else {
            entry.sources.push({
              domain,
              url: sourceUrl,
              citationCount: 1,
              sourceType: classifySourceType(domain) as TriangulatedClaim['sources'][0]['sourceType'],
            });
          }
        } catch {}
      });
      
      // Track brand mentions
      if (isYourBrand) {
        entry.yourBrandMentions++;
      } else {
        const existingComp = entry.competitors.find(c => c.brand.toLowerCase() === brandLower);
        if (existingComp) {
          existingComp.mentions++;
        } else {
          entry.competitors.push({ brand: ec.brand, mentions: 1 });
        }
      }
    });

    console.log('Triangulated claims:', triangulatedClaims.size);
    console.log('Sample triangulated:', Array.from(triangulatedClaims.entries()).slice(0, 3).map(([key, claim]) => ({
      claim: key,
      competitors: claim.competitors.length,
      yourBrand: claim.yourBrandMentions,
      sources: claim.sources.length
    })));

    // ========================================================================
    // STEP 3: Detect missing claims with THRESHOLDS
    // ========================================================================
    
    const missingClaims: TriangulatedClaim[] = [];
    
    triangulatedClaims.forEach((claim) => {
      const competitorMentions = claim.competitors.reduce((sum, c) => sum + c.mentions, 0);
      
      // Apply thresholds
      if (
        competitorMentions >= THRESHOLDS.MIN_CLAIM_FREQUENCY &&
        claim.yourBrandMentions === 0 &&
        claim.sources.length >= 1
      ) {
        missingClaims.push(claim);
      } else {
        // Log why claims are being filtered out
        if (competitorMentions < THRESHOLDS.MIN_CLAIM_FREQUENCY) {
          console.log(`Filtered out "${claim.claim}": competitor mentions ${competitorMentions} < ${THRESHOLDS.MIN_CLAIM_FREQUENCY}`);
        }
        if (claim.yourBrandMentions > 0) {
          console.log(`Filtered out "${claim.claim}": your brand already has ${claim.yourBrandMentions} mentions`);
        }
        if (claim.sources.length < 1) {
          console.log(`Filtered out "${claim.claim}": no sources`);
        }
      }
    });
    
    console.log('Missing claims after thresholds:', missingClaims.length);
    console.log('Sample missing claims:', missingClaims.slice(0, 3).map(c => ({
      claim: c.claim,
      type: c.claimType,
      competitorMentions: c.competitors.reduce((sum, comp) => sum + comp.mentions, 0),
      yourMentions: c.yourBrandMentions
    })));
    
    // Sort by impact (differentiators first, then by frequency)
    missingClaims.sort((a, b) => {
      // Differentiators > table_stakes > disqualifiers
      const typeOrder = { differentiator: 3, table_stakes: 2, disqualifier: 1 };
      const typeScore = (typeOrder[b.claimType] || 0) - (typeOrder[a.claimType] || 0);
      if (typeScore !== 0) return typeScore;
      
      // Then by high-intent prompt count
      const aHighIntent = a.prompts.filter(p => p.promptType === 'high_intent' || p.promptType === 'comparison').length;
      const bHighIntent = b.prompts.filter(p => p.promptType === 'high_intent' || p.promptType === 'comparison').length;
      if (bHighIntent !== aHighIntent) return bHighIntent - aHighIntent;
      
      // Then by total mentions
      const aMentions = a.competitors.reduce((sum, c) => sum + c.mentions, 0);
      const bMentions = b.competitors.reduce((sum, c) => sum + c.mentions, 0);
      return bMentions - aMentions;
    });

    // ========================================================================
    // STEP 4: Generate CONTENT recommendations from missing claims
    // Focus on TOP insights about competitors only
    // ========================================================================
    
    const contentRecommendations: ContentRecommendation[] = [];
    let contentId = 0;
    
    // Sort claims by impact to get the most important ones
    const sortedClaims = missingClaims.sort((a, b) => {
      const scoreA = a.totalMentions * 10 + a.sources.length * 5 + a.prompts.filter(p => p.promptType === 'high_intent').length * 3;
      const scoreB = b.totalMentions * 10 + b.sources.length * 5 + b.prompts.filter(p => p.promptType === 'high_intent').length * 3;
      return scoreB - scoreA;
    });
    
    // Take only top claims up to MAX limit
    const topClaims = sortedClaims.slice(0, THRESHOLDS.MAX_CONTENT_RECOMMENDATIONS);
    
    for (const claim of topClaims) {
      const competitorMentions = claim.competitors.reduce((sum, c) => sum + c.mentions, 0);
      const topCompetitor = claim.competitors.sort((a, b) => b.mentions - a.mentions)[0];
      const highIntentPrompts = claim.prompts.filter(p => 
        p.promptType === 'high_intent' || p.promptType === 'comparison'
      ).length;
      
      // Calculate REAL impact score
      const baseImpact = (claim.prompts.length / totalPrompts) * 100;
      const highIntentBoost = highIntentPrompts * THRESHOLDS.HIGH_INTENT_MULTIPLIER;
      const sourceBoost = claim.sources.filter(s => 
        s.sourceType === 'review_site' || s.sourceType === 'comparison'
      ).length * THRESHOLDS.AUTHORITY_SOURCE_BOOST;
      
      const impactScore = Math.min(100, Math.round(baseImpact + highIntentBoost + sourceBoost));
      
      // Build causal evidence
      const causalEvidence = {
        promptPercentage: Math.round((claim.prompts.length / totalPrompts) * 100),
        highIntentPrompts,
        totalPromptsAffected: claim.prompts.length,
        reinforcingSources: claim.sources.length,
        sourceTypes: [...new Set(claim.sources.map(s => s.sourceType))],
        topCompetitor: topCompetitor?.brand || 'competitors',
        topCompetitorMentions: topCompetitor?.mentions || competitorMentions,
      };
      
      // Generate the MAGIC SENTENCE (why AI says this)
      const whyAISaysThis = generateWhyAISaysThis(claim, causalEvidence);
      const evidenceSummary = generateEvidenceSummary(claim, causalEvidence, totalPrompts);
      
      // Generate content with expected impact
      const recommendedContent = generateContentForClaim(
        claim.claim, 
        companyName, 
        claim.competitors.slice(0, 3).map(c => [c.brand, c.mentions] as [string, number]),
        claim.claimType,
        causalEvidence
      );
      
      contentRecommendations.push({
        id: `content-${contentId++}`,
        missingClaim: claim.claim,
        claimType: claim.claimType,
        causalEvidence,
        evidenceSummary,
        whyAISaysThis,
        impactScore,
        competitorMentions: claim.competitors.slice(0, 4).map(c => ({ brand: c.brand, count: c.mentions })),
        triangulation: {
          prompts: claim.prompts.slice(0, 5).map(p => p.query),
          sources: claim.sources.slice(0, 5).map(s => s.domain),
        },
        recommendedContent,
        priority: impactScore >= 40 ? 'critical' : impactScore >= 20 ? 'high' : 'medium',
      });
    }

    // ========================================================================
    // STEP 5: Generate OUTREACH recommendations with authority thresholds
    // ========================================================================
    
    // Build source authority map
    const sourceAuthority = new Map<string, {
      domain: string;
      citationCount: number;
      promptsAffected: Set<number>;
      competitorsPresent: Set<string>;
      claimsReinforced: Set<string>;
      sourceType: 'review_site' | 'publication' | 'directory' | 'community' | 'comparison' | 'other';
    }>();
    
    extractedClaims.forEach(ec => {
      ec.sources.forEach(sourceUrl => {
        try {
          const domain = new URL(sourceUrl).hostname.replace('www.', '');
          if (!sourceAuthority.has(domain)) {
            sourceAuthority.set(domain, {
              domain,
              citationCount: 0,
              promptsAffected: new Set(),
              competitorsPresent: new Set(),
              claimsReinforced: new Set(),
              sourceType: classifySourceType(domain) as any,
            });
          }
          
          const entry = sourceAuthority.get(domain)!;
          entry.citationCount++;
          entry.promptsAffected.add(ec.promptIndex);
          entry.claimsReinforced.add(ec.claim);
          
          const brandLower = ec.brand.toLowerCase();
          if (brandLower !== yourBrand && !brandLower.includes(yourBrand) && !yourBrand.includes(brandLower)) {
            entry.competitorsPresent.add(ec.brand);
          }
        } catch {}
      });
    });
    
    const outreachRecommendations: OutreachRecommendation[] = [];
    let outreachId = 0;
    
    const actionableTypes = ['review_site', 'publication', 'directory', 'community'];
    
    sourceAuthority.forEach((source) => {
      // Apply AUTHORITY THRESHOLDS
      if (
        actionableTypes.includes(source.sourceType) &&
        source.citationCount >= THRESHOLDS.MIN_SOURCE_CITATIONS &&
        source.competitorsPresent.size >= 1
      ) {
        // Calculate authority score
        const authorityScore = 
          source.citationCount * 10 + 
          source.promptsAffected.size * 5 + 
          source.competitorsPresent.size * 3 +
          (source.sourceType === 'review_site' ? 20 : 0) +
          (source.sourceType === 'directory' ? 15 : 0);
        
        const priority = authorityScore >= 50 ? 'critical' : authorityScore >= 30 ? 'high' : 'medium';
        
        outreachRecommendations.push({
          id: `outreach-${outreachId++}`,
          type: source.sourceType as any,
          platform: source.domain,
          url: `https://${source.domain}`,
          reason: generateOutreachReason(source),
          causalEvidence: {
            citationCount: source.citationCount,
            promptsAffected: source.promptsAffected.size,
            competitorsPresent: source.competitorsPresent.size,
            claimsReinforced: Array.from(source.claimsReinforced).slice(0, 3),
          },
          competitorPresence: Array.from(source.competitorsPresent),
          priority,
          actions: generateOutreachActions(source.sourceType, source.domain, companyName),
          authorityScore,
        });
      }
    });
    
    // Sort by authority score
    outreachRecommendations.sort((a, b) => b.authorityScore - a.authorityScore);

    console.log('=== FINAL RESULTS ===');
    console.log('Content recommendations:', contentRecommendations.length);
    console.log('Outreach recommendations:', outreachRecommendations.length);
    console.log('Stats:', {
      totalPrompts,
      totalClaimsExtracted: extractedClaims.length,
      uniqueClaims: triangulatedClaims.size,
      missingClaims: missingClaims.length,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalPrompts,
        totalClaimsExtracted: extractedClaims.length,
        uniqueClaims: triangulatedClaims.size,
        missingClaims: missingClaims.length,
        actionableSources: outreachRecommendations.length,
      },
      contentRecommendations,
      outreachRecommendations: outreachRecommendations.slice(0, 8),
    });

  } catch (error) {
    console.error("Extract claims error:", error);
    return NextResponse.json({ success: false, error: "Failed to extract claims" }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function classifyPromptType(query: string): 'high_intent' | 'comparison' | 'discovery' | 'general' {
  const q = query.toLowerCase();
  
  // High intent - ready to buy/use
  if (q.includes('best') || q.includes('top') || q.includes('recommend') || 
      q.includes('should i use') || q.includes('which') || q.includes('pricing')) {
    return 'high_intent';
  }
  
  // Comparison - explicitly comparing
  if (q.includes(' vs ') || q.includes('versus') || q.includes('alternative') ||
      q.includes('compare') || q.includes('difference between')) {
    return 'comparison';
  }
  
  // Discovery - learning about category
  if (q.includes('what is') || q.includes('how does') || q.includes('explain') ||
      q.includes('types of') || q.includes('examples of')) {
    return 'discovery';
  }
  
  return 'general';
}

function classifySourceType(domain: string): string {
  const d = domain.toLowerCase();
  
  const reviewSites = ['g2.com', 'capterra.com', 'trustradius.com', 'getapp.com', 'softwareadvice.com', 'trustpilot.com'];
  const publications = ['techcrunch.com', 'forbes.com', 'wired.com', 'theverge.com', 'venturebeat.com', 'zdnet.com', 'cnet.com'];
  const directories = ['producthunt.com', 'alternativeto.net', 'slant.co', 'stackshare.io', 'saasworthy.com'];
  const communities = ['reddit.com', 'medium.com', 'dev.to', 'quora.com', 'stackoverflow.com'];
  const comparison = ['versus.com', 'slashdot.org', 'sourceforge.net'];
  
  if (reviewSites.some(s => d.includes(s))) return 'review_site';
  if (publications.some(s => d.includes(s))) return 'publication';
  if (directories.some(s => d.includes(s))) return 'directory';
  if (communities.some(s => d.includes(s))) return 'community';
  if (comparison.some(s => d.includes(s))) return 'comparison';
  
  return 'other';
}

function generateWhyAISaysThis(claim: TriangulatedClaim, evidence: ContentRecommendation['causalEvidence']): string {
  const sourceTypes = evidence.sourceTypes.filter(t => t !== 'other');
  const sourceDesc = sourceTypes.length > 0 
    ? sourceTypes.map(t => t.replace('_', ' ')).join(' and ') + ' articles'
    : 'multiple sources';
  
  return `AI associates "${claim.claim}" with ${evidence.topCompetitor} because ${evidence.reinforcingSources} ${sourceDesc} repeatedly mention this. When users ask about this topic, AI retrieves these sources and reinforces the claim. You're missing because no authoritative sources make this claim about you.`;
}

function generateEvidenceSummary(claim: TriangulatedClaim, evidence: ContentRecommendation['causalEvidence'], totalPrompts: number): string {
  const parts: string[] = [];
  
  parts.push(`Appears in ${evidence.promptPercentage}% of prompts (${evidence.totalPromptsAffected}/${totalPrompts})`);
  
  if (evidence.highIntentPrompts > 0) {
    parts.push(`${evidence.highIntentPrompts} high-intent/comparison prompts`);
  }
  
  parts.push(`Reinforced by ${evidence.reinforcingSources} sources`);
  parts.push(`${evidence.topCompetitor} mentioned ${evidence.topCompetitorMentions}× for this claim`);
  
  return parts.join(' • ');
}

function generateContentForClaim(
  claim: string, 
  brandName: string, 
  topCompetitors: [string, number][],
  claimType: ClaimType,
  causalEvidence: ContentRecommendation['causalEvidence']
): ContentRecommendation['recommendedContent'] {
  const content: ContentRecommendation['recommendedContent'] = [];
  const claimCapitalized = claim.charAt(0).toUpperCase() + claim.slice(1);
  const impactPct = causalEvidence.promptPercentage;
  
  // Blog post about the claim
  content.push({
    type: 'blog',
    title: `How ${brandName} Delivers ${claimCapitalized}`,
    outline: [
      `Why ${claim} matters in today's market`,
      `How ${brandName} approaches ${claim}`,
      `Real examples and case studies`,
      `Comparison with traditional solutions`,
      `Getting started with ${brandName}`,
    ],
    reason: `AI mentions "${claim}" for competitors but never for you. This blog will establish your association with this claim.`,
    expectedImpact: `Publishing this could influence ${impactPct}% of prompts where this claim appears. ${claimType === 'differentiator' ? 'This is a differentiator - high value.' : ''}`,
  });

  // Dedicated page
  content.push({
    type: 'page',
    title: `${brandName} ${claimCapitalized}`,
    outline: [
      `Overview of ${claim} capabilities`,
      `Key features that enable ${claim}`,
      `Customer testimonials`,
      `Pricing and plans`,
      `FAQ about ${claim}`,
    ],
    reason: `Create a permanent, indexable page that AI can reference when discussing ${claim}.`,
    expectedImpact: `A dedicated page gives AI a clear source to cite. Currently ${causalEvidence.reinforcingSources} sources reinforce this for competitors.`,
  });

  // Comparison with top competitor
  if (topCompetitors.length > 0) {
    const topComp = topCompetitors[0][0];
    const topCompMentions = topCompetitors[0][1];
    content.push({
      type: 'comparison',
      title: `${brandName} vs ${topComp}: ${claimCapitalized} Comparison`,
      outline: [
        `${brandName} and ${topComp} at a glance`,
        `${claimCapitalized}: head-to-head comparison`,
        `Pricing comparison`,
        `When to choose ${brandName}`,
        `When to choose ${topComp}`,
        `Migration guide`,
      ],
      reason: `${topComp} is mentioned ${topCompMentions} times for "${claim}". This comparison will capture "alternatives to ${topComp}" searches.`,
      expectedImpact: `Comparison pages are heavily weighted by AI. ${causalEvidence.highIntentPrompts} high-intent prompts could be influenced.`,
    });
  }

  return content;
}

function generateOutreachReason(source: {
  domain: string;
  citationCount: number;
  promptsAffected: Set<number>;
  competitorsPresent: Set<string>;
  claimsReinforced: Set<string>;
}): string {
  const competitors = Array.from(source.competitorsPresent).slice(0, 2).join(', ');
  const claims = Array.from(source.claimsReinforced).slice(0, 2).join(', ');
  
  return `Cited ${source.citationCount}× across ${source.promptsAffected.size} prompts. ${competitors} are present here. AI uses this source to reinforce claims like "${claims}".`;
}

function generateOutreachActions(type: string, domain: string, brandName: string): string[] {
  switch (type) {
    case 'review_site':
      return [
        `Claim your ${brandName} profile on ${domain}`,
        `Add complete product description with key features`,
        `Launch review collection campaign (target 10+ reviews)`,
        `Respond to existing reviews professionally`,
      ];
    case 'publication':
      return [
        `Pitch a guest article about your unique approach`,
        `Offer founder interview or case study`,
        `Share newsworthy updates (funding, milestones)`,
        `Build relationship with relevant journalists`,
      ];
    case 'directory':
      return [
        `Submit ${brandName} to ${domain}`,
        `Optimize listing with detailed description`,
        `Add comparison with alternatives`,
        `Encourage users to upvote/review`,
      ];
    case 'community':
      return [
        `Create authentic presence on ${domain}`,
        `Answer relevant questions mentioning your category`,
        `Share valuable content (not promotional)`,
        `Build reputation before mentioning ${brandName}`,
      ];
    default:
      return [`Get ${brandName} mentioned on ${domain}`];
  }
}
