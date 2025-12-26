import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ContentSuggestion {
  type: 'blog' | 'comparison' | 'use_case_page' | 'review_site';
  title: string;
  outline?: string[];
  url?: string;
  reason: string;
}

interface Action {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'category_identity' | 'use_case' | 'comparison' | 'authority' | 'decision_topics' | 'consistency';
  title: string;
  description: string;
  insight: string;
  reason: string; // Why this action based on simulation data
  contentSuggestions?: ContentSuggestion[]; // Exact content to create
  steps: string[];
  evidence: {
    prompts?: string[];
    competitors?: string[];
    sources?: string[];
    stat?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yourBrand, simulationResults, topics, competitors, description } = body;

    if (!yourBrand || !simulationResults) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const actions: Action[] = [];
    let actionId = 1;

    // === CORE METRICS ===
    const totalResults = simulationResults.length;
    const yourMentions = simulationResults.filter((r: any) => r.yourBrandMentioned).length;
    const yourVisibility = totalResults > 0 ? (yourMentions / totalResults) * 100 : 0;
    const missedPrompts = simulationResults.filter((r: any) => !r.yourBrandMentioned);

    // === COMPETITOR ANALYSIS ===
    const competitorMentions = new Map<string, number>();
    const competitorInPrompts = new Map<string, string[]>(); // which prompts mention each competitor
    
    simulationResults.forEach((result: any) => {
      result.mentionedBrands?.forEach((brand: any) => {
        if (brand.name.toLowerCase() !== yourBrand.toLowerCase()) {
          competitorMentions.set(brand.name, (competitorMentions.get(brand.name) || 0) + 1);
          if (!competitorInPrompts.has(brand.name)) {
            competitorInPrompts.set(brand.name, []);
          }
          competitorInPrompts.get(brand.name)!.push(result.query);
        }
      });
    });

    const topCompetitors = Array.from(competitorMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // === PROMPT PATTERN ANALYSIS ===
    // Categorize prompts to find where you're weak
    const promptPatterns = {
      recommendation: [] as any[], // "best X for Y"
      constraint: [] as any[],     // "affordable", "enterprise", "small team"
      alternative: [] as any[],    // "alternatives to X"
      feature: [] as any[],        // "X with feature Y"
      problem: [] as any[],        // "I need X to do Y"
    };

    simulationResults.forEach((result: any) => {
      const query = result.query.toLowerCase();
      
      if (query.includes('best') || query.includes('top') || query.includes('recommend')) {
        promptPatterns.recommendation.push(result);
      }
      if (query.includes('affordable') || query.includes('cheap') || query.includes('budget') ||
          query.includes('enterprise') || query.includes('small team') || query.includes('startup') ||
          query.includes('compliance') || query.includes('security') || query.includes('scale')) {
        promptPatterns.constraint.push(result);
      }
      if (query.includes('alternative') || query.includes('instead of') || query.includes('like')) {
        promptPatterns.alternative.push(result);
      }
      if (query.includes('with') || query.includes('that has') || query.includes('integrates')) {
        promptPatterns.feature.push(result);
      }
      if (query.includes('i need') || query.includes('looking for') || query.includes('i want')) {
        promptPatterns.problem.push(result);
      }
    });

    // === GENERATE ACTIONS BASED ON ANALYSIS ===

    // ------------------------------------------
    // ACTION 1: CATEGORY IDENTITY ISSUE
    // If you're not appearing, AI might not know what category you belong to
    // ------------------------------------------
    if (yourVisibility < 40) {
      // Find what category competitors are associated with
      const dominantCompetitor = topCompetitors[0];
      
      // Extract category from description or infer from prompts
      const categoryMatch = description?.match(/\b(\w+\s+\w+(?:\s+\w+)?)\s+(?:platform|tool|software|app|assistant|service)\b/i);
      const inferredCategory = categoryMatch ? categoryMatch[0] : 'your product category';
      
      actions.push({
        id: `action-${actionId++}`,
        priority: 'high',
        category: 'category_identity',
        title: 'Define your category clearly and consistently',
        description: `AI doesn't know what bucket you belong to. When AI is unsure of your category, you won't appear in recommendations.`,
        insight: `You appear in only ${yourVisibility.toFixed(0)}% of prompts. ${dominantCompetitor ? `${dominantCompetitor[0]} appears in ${((dominantCompetitor[1]/totalResults)*100).toFixed(0)}% - they have a clearer category identity.` : ''}`,
        reason: `In ${missedPrompts.length} prompts where you didn't appear, AI couldn't categorize you. ${dominantCompetitor ? `${dominantCompetitor[0]} consistently appears because they're clearly defined as "${inferredCategory}".` : 'Competitors have clear category definitions.'}`,
        contentSuggestions: [
          {
            type: 'blog',
            title: `What is ${yourBrand}? Understanding ${inferredCategory}`,
            outline: [
              `Introduction: The ${inferredCategory} landscape`,
              `What makes ${yourBrand} different`,
              `Best for: [specific use cases]`,
              `Not designed for: [what you're not]`,
              `How ${yourBrand} compares to traditional solutions`,
            ],
            reason: `AI needs a clear definition page. This blog will establish your category identity.`,
          },
        ],
        steps: [
          'Pick ONE primary category (e.g., "AI meeting assistant" not "AI-powered productivity platform")',
          'Use the EXACT same category wording on: Homepage, About page, Docs, Blog intros',
          'Publish the suggested blog post to define your category',
          'Add clear "Best for X / Not for Y" statements on your homepage',
        ],
        evidence: {
          stat: `${yourVisibility.toFixed(0)}% visibility`,
          competitors: dominantCompetitor ? [dominantCompetitor[0]] : [],
          prompts: missedPrompts.slice(0, 3).map((r: any) => r.query),
        },
      });
    }

    // ------------------------------------------
    // ACTION 2: USE-CASE ASSOCIATION GAPS
    // Find specific use cases where you're missing
    // ------------------------------------------
    const useCaseKeywords = ['startup', 'enterprise', 'small team', 'remote', 'developer', 'marketer', 'sales', 'freelancer'];
    const weakUseCases: { useCase: string; prompts: any[]; competitorsDominating: string[] }[] = [];

    useCaseKeywords.forEach(useCase => {
      const relevantPrompts = simulationResults.filter((r: any) => 
        r.query.toLowerCase().includes(useCase)
      );
      
      if (relevantPrompts.length > 0) {
        const yourAppearances = relevantPrompts.filter((r: any) => r.yourBrandMentioned).length;
        const appearanceRate = yourAppearances / relevantPrompts.length;
        
        if (appearanceRate < 0.3) {
          // Find which competitors dominate this use case
          const competitorsHere = new Map<string, number>();
          relevantPrompts.forEach((r: any) => {
            r.mentionedBrands?.forEach((b: any) => {
              if (b.name.toLowerCase() !== yourBrand.toLowerCase()) {
                competitorsHere.set(b.name, (competitorsHere.get(b.name) || 0) + 1);
              }
            });
          });
          
          weakUseCases.push({
            useCase,
            prompts: relevantPrompts,
            competitorsDominating: Array.from(competitorsHere.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([name]) => name),
          });
        }
      }
    });

    if (weakUseCases.length > 0) {
      const topWeakUseCase = weakUseCases[0];
      
      actions.push({
        id: `action-${actionId++}`,
        priority: 'high',
        category: 'use_case',
        title: `You're invisible for "${topWeakUseCase.useCase}" use case`,
        description: `AI doesn't associate you with "${topWeakUseCase.useCase}". ${topWeakUseCase.competitorsDominating.length > 0 ? `${topWeakUseCase.competitorsDominating.join(' and ')} dominate this space.` : ''}`,
        insight: `When users ask about "${topWeakUseCase.useCase}", AI recommends competitors instead of you.`,
        reason: `In ${topWeakUseCase.prompts.length} prompts mentioning "${topWeakUseCase.useCase}", you appeared 0 times. ${topWeakUseCase.competitorsDominating[0] || 'Competitors'} appear because they explicitly target this use case.`,
        contentSuggestions: [
          {
            type: 'use_case_page',
            title: `${yourBrand} for ${topWeakUseCase.useCase}: Complete Guide`,
            outline: [
              `Why ${topWeakUseCase.useCase} need ${yourBrand}`,
              `Key features for ${topWeakUseCase.useCase}`,
              `Case study: How [Company] uses ${yourBrand}`,
              `Pricing for ${topWeakUseCase.useCase}`,
              `Getting started guide`,
            ],
            reason: `AI needs explicit use-case association. This page will make you discoverable for "${topWeakUseCase.useCase}" searches.`,
          },
          {
            type: 'blog',
            title: `Best Tools for ${topWeakUseCase.useCase} in 2025`,
            outline: [
              `Challenges ${topWeakUseCase.useCase} face`,
              `Top 5 tools for ${topWeakUseCase.useCase} (include ${yourBrand})`,
              `${yourBrand}: Best for [specific scenario]`,
              `Comparison table`,
              `How to choose the right tool`,
            ],
            reason: `AI loves "best for X" content. This positions you in the ${topWeakUseCase.useCase} category.`,
          },
        ],
        steps: [
          `Create the suggested use-case page: "${yourBrand} for ${topWeakUseCase.useCase}"`,
          `Publish the "Best tools for ${topWeakUseCase.useCase}" blog post`,
          `Add "${topWeakUseCase.useCase}" to your homepage copy`,
          `Publish case studies featuring ${topWeakUseCase.useCase} customers`,
        ],
        evidence: {
          prompts: topWeakUseCase.prompts.slice(0, 3).map((r: any) => r.query),
          competitors: topWeakUseCase.competitorsDominating,
          stat: `0% visibility for "${topWeakUseCase.useCase}" prompts`,
        },
      });
    }

    // ------------------------------------------
    // ACTION 3: COMPARISON PRESENCE
    // You need to be in comparisons to exist in AI's worldview
    // ------------------------------------------
    const alternativePrompts = promptPatterns.alternative;
    const yourAltAppearances = alternativePrompts.filter((r: any) => r.yourBrandMentioned).length;
    
    if (alternativePrompts.length > 0 && yourAltAppearances < alternativePrompts.length * 0.5) {
      const competitorsInAlternatives = new Set<string>();
      alternativePrompts.forEach((r: any) => {
        r.mentionedBrands?.forEach((b: any) => {
          if (b.name.toLowerCase() !== yourBrand.toLowerCase()) {
            competitorsInAlternatives.add(b.name);
          }
        });
      });

      const topCompetitorsInAlts = Array.from(competitorsInAlternatives).slice(0, 3);
      
      actions.push({
        id: `action-${actionId++}`,
        priority: 'high',
        category: 'comparison',
        title: 'You\'re missing from "alternatives" searches',
        description: `When users ask for alternatives to competitors, you don't appear. You need to be part of comparison content.`,
        insight: `You appear in ${((yourAltAppearances/Math.max(alternativePrompts.length, 1))*100).toFixed(0)}% of "alternative to X" prompts.`,
        reason: `In ${alternativePrompts.length} "alternatives" prompts, ${topCompetitorsInAlts.join(', ')} appear but you don't. AI learns from comparison content - if you're not compared, you don't exist.`,
        contentSuggestions: topCompetitorsInAlts.map(comp => ({
          type: 'comparison' as const,
          title: `${yourBrand} vs ${comp}: Which is Better for Your Team?`,
          outline: [
            `${yourBrand} and ${comp}: Overview`,
            `Key differences in features`,
            `Pricing comparison`,
            `When to choose ${yourBrand}`,
            `When to choose ${comp}`,
            `Migration guide from ${comp} to ${yourBrand}`,
          ],
          reason: `${comp} appears in ${alternativePrompts.filter((r: any) => r.mentionedBrands?.some((b: any) => b.name === comp)).length} prompts. This comparison will make you discoverable in "alternatives to ${comp}" searches.`,
        })),
        steps: [
          `Create comparison pages for: ${topCompetitorsInAlts.join(', ')}`,
          'Be honest about trade-offs - AI trusts balanced comparisons',
          'Add comparison pages to your main navigation',
          'Include pricing and feature comparison tables',
        ],
        evidence: {
          prompts: alternativePrompts.slice(0, 3).map((r: any) => r.query),
          competitors: topCompetitorsInAlts,
          stat: `${((yourAltAppearances/Math.max(alternativePrompts.length, 1))*100).toFixed(0)}% visibility in alternatives`,
        },
      });
    }

    // ------------------------------------------
    // ACTION 4: THIRD-PARTY AUTHORITY
    // Check if competitors are on sources you're not
    // ------------------------------------------
    const allSources = new Set<string>();
    simulationResults.forEach((r: any) => {
      r.sources?.forEach((s: any) => {
        if (s.url) {
          try {
            const domain = new URL(s.url).hostname.replace('www.', '');
            allSources.add(domain);
          } catch {}
        }
      });
    });

    const authoritySources = Array.from(allSources).filter(s => 
      s.includes('wikipedia') || s.includes('g2.com') || s.includes('capterra') || 
      s.includes('github') || s.includes('producthunt') || s.includes('techcrunch') ||
      s.includes('forbes') || s.includes('medium.com')
    );

    if (authoritySources.length > 0 && yourVisibility < 60) {
      const reviewSites = authoritySources.filter(s => s.includes('g2') || s.includes('capterra') || s.includes('producthunt'));
      const mediaSites = authoritySources.filter(s => s.includes('techcrunch') || s.includes('forbes') || s.includes('medium'));
      
      actions.push({
        id: `action-${actionId++}`,
        priority: 'high',
        category: 'authority',
        title: 'Get mentioned on third-party authority sites',
        description: `AI trusts third-party sources more than your own website. Competitors are being cited from authoritative sources.`,
        insight: `AI is citing: ${authoritySources.slice(0, 3).join(', ')}. You need presence on these.`,
        reason: `Competitors appear in ${simulationResults.filter((r: any) => r.sources?.some((s: any) => authoritySources.some(as => s.url?.includes(as)))).length} prompts because they're mentioned on ${authoritySources.length} authority sites. Your own website alone is weak.`,
        contentSuggestions: [
          ...reviewSites.slice(0, 2).map(site => ({
            type: 'review_site' as const,
            title: `Claim and optimize ${site} profile`,
            url: site.includes('g2') ? 'https://www.g2.com' : site.includes('capterra') ? 'https://www.capterra.com' : 'https://www.producthunt.com',
            reason: `${site} is cited in AI responses. Get 10+ reviews here to build authority.`,
          })),
          ...mediaSites.slice(0, 1).map(site => ({
            type: 'blog' as const,
            title: `Publish on ${site}: "${yourBrand} - [Your Category] for [Use Case]"`,
            outline: [
              'Industry problem overview',
              `How ${yourBrand} solves it differently`,
              'Customer success stories',
              'Future roadmap',
            ],
            reason: `${site} is an authority source. Publishing here will make AI cite you.`,
          })),
        ],
        steps: [
          `Claim profiles on: ${reviewSites.join(', ')}`,
          'Launch review collection campaign (target 10+ reviews)',
          `Pitch guest posts to: ${mediaSites.join(', ')}`,
          'Ensure all profiles have complete descriptions (AI needs text)',
        ],
        evidence: {
          sources: authoritySources.slice(0, 5),
          stat: `${authoritySources.length} authority sources citing competitors`,
        },
      });
    }

    // ------------------------------------------
    // ACTION 5: CONSTRAINT-BASED DISAPPEARANCE
    // When pricing/enterprise/scale is mentioned, do you vanish?
    // ------------------------------------------
    const constraintPrompts = promptPatterns.constraint;
    const yourConstraintAppearances = constraintPrompts.filter((r: any) => r.yourBrandMentioned).length;
    
    if (constraintPrompts.length > 0 && yourConstraintAppearances < constraintPrompts.length * 0.3) {
      // Find which constraints make you disappear
      const constraintTypes = {
        pricing: constraintPrompts.filter((r: any) => 
          r.query.toLowerCase().includes('affordable') || r.query.toLowerCase().includes('cheap') || r.query.toLowerCase().includes('budget') || r.query.toLowerCase().includes('free')
        ),
        enterprise: constraintPrompts.filter((r: any) => 
          r.query.toLowerCase().includes('enterprise') || r.query.toLowerCase().includes('compliance') || r.query.toLowerCase().includes('security')
        ),
        scale: constraintPrompts.filter((r: any) => 
          r.query.toLowerCase().includes('scale') || r.query.toLowerCase().includes('large team')
        ),
      };

      const worstConstraint = Object.entries(constraintTypes)
        .filter(([_, prompts]) => prompts.length > 0)
        .map(([type, prompts]) => ({
          type,
          prompts,
          yourAppearances: prompts.filter((r: any) => r.yourBrandMentioned).length,
          rate: prompts.filter((r: any) => r.yourBrandMentioned).length / prompts.length,
        }))
        .sort((a, b) => a.rate - b.rate)[0];

      if (worstConstraint && worstConstraint.rate < 0.3) {
        const constraintLabels: Record<string, string> = {
          pricing: 'pricing/budget',
          enterprise: 'enterprise/compliance',
          scale: 'scale/large teams',
        };

        actions.push({
          id: `action-${actionId++}`,
          priority: 'high',
          category: 'decision_topics',
          title: `You disappear when "${constraintLabels[worstConstraint.type]}" is mentioned`,
          description: `When users add constraints like "${worstConstraint.type}", AI excludes you. This is a decision topic gap.`,
          insight: `${(worstConstraint.rate * 100).toFixed(0)}% visibility when ${worstConstraint.type} is mentioned vs ${yourVisibility.toFixed(0)}% overall.`,
          reason: `In ${worstConstraint.prompts.length} prompts with ${worstConstraint.type} constraints, you appeared only ${worstConstraint.yourAppearances} times. AI excludes you because you haven't publicly addressed ${worstConstraint.type}.`,
          contentSuggestions: [
            {
              type: 'blog',
              title: worstConstraint.type === 'pricing' ? `${yourBrand} Pricing: Complete Guide for 2025` : worstConstraint.type === 'enterprise' ? `${yourBrand} for Enterprise: Security, Compliance & Scale` : `${yourBrand} at Scale: Performance for Large Teams`,
              outline: worstConstraint.type === 'pricing' ? [
                `${yourBrand} pricing tiers explained`,
                'What\'s included in each plan',
                'Cost comparison vs competitors',
                'ROI calculator',
                'When ${yourBrand} is worth the investment',
              ] : worstConstraint.type === 'enterprise' ? [
                `${yourBrand} enterprise features`,
                'Security & compliance (SOC2, GDPR, etc.)',
                'Enterprise support & SLAs',
                'Case studies: Enterprise customers',
                'Migration guide for large organizations',
              ] : [
                `How ${yourBrand} handles scale`,
                'Performance benchmarks',
                'Infrastructure & reliability',
                'Large team management features',
                'Case studies: Companies with 1000+ users',
              ],
              reason: `AI needs explicit ${worstConstraint.type} information. This page will make you discoverable in ${worstConstraint.type}-related searches.`,
            },
          ],
          steps: [
            `Publish the suggested ${worstConstraint.type} blog post`,
            `Add ${worstConstraint.type} information to your homepage`,
            'If you support this constraint, say it explicitly everywhere',
            'If you DON\'T, say "Not designed for X" - AI trusts honesty',
          ],
          evidence: {
            prompts: worstConstraint.prompts.slice(0, 3).map((r: any) => r.query),
            stat: `${(worstConstraint.rate * 100).toFixed(0)}% visibility for ${worstConstraint.type} queries`,
          },
        });
      }
    }

    // ------------------------------------------
    // ACTION 6: POSITION RANKING ISSUE
    // If you appear but always low, it's a density/consistency issue
    // ------------------------------------------
    const yourPositions = simulationResults
      .filter((r: any) => r.yourBrandMentioned && r.yourBrandPosition)
      .map((r: any) => r.yourBrandPosition);
    
    const avgPosition = yourPositions.length > 0 
      ? yourPositions.reduce((a: number, b: number) => a + b, 0) / yourPositions.length 
      : 0;

    if (yourPositions.length > 0 && avgPosition > 3) {
      const topPosition = Math.min(...yourPositions);
      const bottomPosition = Math.max(...yourPositions);

      actions.push({
        id: `action-${actionId++}`,
        priority: 'medium',
        category: 'consistency',
        title: 'You appear but rank low - build content density',
        description: `When you're mentioned, you're typically position #${avgPosition.toFixed(1)}. AI prefers brands with dense, consistent narratives.`,
        insight: `Your position ranges from #${topPosition} to #${bottomPosition}. Top competitors consistently rank #1-2.`,
        reason: `You appear in ${yourPositions.length} prompts but average position #${avgPosition.toFixed(1)}. This means your narrative is weak or inconsistent. AI ranks brands with dense, repeated messaging higher.`,
        steps: [
          'Audit all pages - ensure category and use-case language is IDENTICAL',
          'Consolidate content: 2-3 deep authoritative pages > 10 shallow ones',
          'Remove creative variations - use exact phrases everywhere',
          'Ensure homepage = docs = blog = external mentions tell the same story',
        ],
        evidence: {
          stat: `Average position: #${avgPosition.toFixed(1)}`,
        },
      });
    }

    // ------------------------------------------
    // ACTION 7: COMPETITOR-SPECIFIC ANALYSIS
    // Who appears where you don't?
    // ------------------------------------------
    if (topCompetitors.length > 0 && yourVisibility < 50) {
      const dominantCompetitor = topCompetitors[0];
      const promptsWhereCompetitorAppearsYouDont = simulationResults.filter((r: any) => 
        !r.yourBrandMentioned && 
        r.mentionedBrands?.some((b: any) => b.name === dominantCompetitor[0])
      );

      if (promptsWhereCompetitorAppearsYouDont.length > 2) {
        actions.push({
          id: `action-${actionId++}`,
          priority: 'medium',
          category: 'comparison',
          title: `${dominantCompetitor[0]} appears where you don't`,
          description: `In ${promptsWhereCompetitorAppearsYouDont.length} prompts, ${dominantCompetitor[0]} is recommended but you're not. Study their positioning.`,
          insight: `${dominantCompetitor[0]} has ${((dominantCompetitor[1]/totalResults)*100).toFixed(0)}% visibility. Analyze what associations they've built that you haven't.`,
          reason: `${dominantCompetitor[0]} appears in ${dominantCompetitor[1]} prompts (${((dominantCompetitor[1]/totalResults)*100).toFixed(0)}%) vs your ${yourMentions} (${yourVisibility.toFixed(0)}%). They've built stronger category identity, use-case associations, or third-party presence.`,
          steps: [
            `Review ${dominantCompetitor[0]}'s homepage - what category do they claim?`,
            'Check their Wikipedia, G2, and review site presence',
            'Look at what use cases they explicitly target',
            'Create comparison content: "When to choose us vs them"',
          ],
          evidence: {
            prompts: promptsWhereCompetitorAppearsYouDont.slice(0, 3).map((r: any) => r.query),
            competitors: [dominantCompetitor[0]],
            stat: `${promptsWhereCompetitorAppearsYouDont.length} prompts where they appear, you don't`,
          },
        });
      }
    }

    // === GENERATE SUMMARY ===
    const summaryPrompt = `You're analyzing AI visibility for "${yourBrand}".

Data:
- Visibility: ${yourVisibility.toFixed(1)}% (appears in ${yourMentions}/${totalResults} prompts)
- Top competitor: ${topCompetitors[0]?.[0] || 'N/A'} at ${topCompetitors[0] ? ((topCompetitors[0][1]/totalResults)*100).toFixed(0) : 0}%
- Key gaps found: ${actions.map(a => a.category).join(', ')}

Write a 2-sentence brutally honest diagnosis. Focus on the ROOT CAUSE of low visibility (category confusion? missing from comparisons? no third-party presence?). No fluff.`;

    const summaryCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a brutally honest AI visibility analyst. No marketing speak. Diagnose problems directly.",
        },
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
      max_tokens: 120,
      temperature: 0.3,
    });

    const strategySummary = summaryCompletion.choices[0]?.message?.content?.trim() || 
      `Your brand appears in ${yourVisibility.toFixed(0)}% of AI responses. Focus on category clarity and third-party presence.`;

    return NextResponse.json({
      success: true,
      actions,
      summary: {
        totalActions: actions.length,
        highPriority: actions.filter(a => a.priority === 'high').length,
        mediumPriority: actions.filter(a => a.priority === 'medium').length,
        visibility: yourVisibility,
        topCompetitor: topCompetitors[0]?.[0] || null,
        topCompetitorVisibility: topCompetitors[0] ? ((topCompetitors[0][1]/totalResults)*100) : 0,
        strategySummary,
      },
    });
  } catch (error) {
    console.error("Error generating actions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate actions" },
      { status: 500 }
    );
  }
}
