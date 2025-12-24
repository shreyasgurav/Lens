import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Action {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'source_presence' | 'content_creation' | 'topic_coverage' | 'seo';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  steps: string[];
  evidence: {
    competitorExamples?: string[];
    sourceUrls?: string[];
    queryExamples?: string[];
    mentionCount?: number;
    frequency?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yourBrand, simulationResults, topics, competitors } = body;

    if (!yourBrand || !simulationResults || !topics) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const actions: Action[] = [];
    let actionId = 1;

    // Analyze simulation results
    const totalResults = simulationResults.length;
    const yourMentions = simulationResults.filter((r: any) => r.yourBrandMentioned).length;
    const yourVisibility = totalResults > 0 ? (yourMentions / totalResults) * 100 : 0;

    // Track competitor data
    const competitorStats = new Map<string, {
      mentions: number;
      sources: Set<string>;
      topics: Set<string>;
      contentTypes: Set<string>;
    }>();

    competitors.forEach((comp: any) => {
      competitorStats.set(comp.name, {
        mentions: 0,
        sources: new Set(),
        topics: new Set(),
        contentTypes: new Set(),
      });
    });

    // Analyze each result
    simulationResults.forEach((result: any) => {
      result.mentionedBrands?.forEach((brand: any) => {
        const stats = competitorStats.get(brand.name);
        if (stats) {
          stats.mentions++;
          
          // Track sources
          result.brandSourceMappings?.forEach((mapping: any) => {
            if (mapping.brand === brand.name) {
              mapping.mentionedInSources.forEach((src: string) => stats.sources.add(src));
              stats.contentTypes.add(mapping.contentType);
            }
          });
          
          // Track topics
          topics.forEach((topic: any) => {
            if (topic.selected && result.query.toLowerCase().includes(topic.name.toLowerCase().split(' ')[0])) {
              stats.topics.add(topic.name);
            }
          });
        }
      });
    });

    // Find top competitors
    const topCompetitors = Array.from(competitorStats.entries())
      .sort((a, b) => b[1].mentions - a[1].mentions)
      .slice(0, 3);

    // Collect all unique sources from competitors
    const allCompetitorSources = new Set<string>();
    competitorStats.forEach(stats => {
      stats.sources.forEach(src => allCompetitorSources.add(src));
    });

    // Identify source types
    const sourceTypes = {
      wikipedia: Array.from(allCompetitorSources).filter(s => s.includes('wikipedia')),
      g2: Array.from(allCompetitorSources).filter(s => s.includes('g2.com')),
      capterra: Array.from(allCompetitorSources).filter(s => s.includes('capterra')),
      reviews: Array.from(allCompetitorSources).filter(s => s.includes('review')),
      blogs: Array.from(allCompetitorSources).filter(s => 
        s.includes('medium.com') || s.includes('techcrunch') || s.includes('blog')
      ),
    };

    // ACTION 1: Wikipedia presence
    if (sourceTypes.wikipedia.length > 0 && yourVisibility < 50) {
      const competitorsWithWikipedia = topCompetitors
        .filter(([_, stats]) => Array.from(stats.sources).some(s => s.includes('wikipedia')))
        .map(([name]) => name);

      if (competitorsWithWikipedia.length > 0) {
        actions.push({
          id: `action-${actionId++}`,
          priority: 'high',
          category: 'source_presence',
          title: 'Create or improve Wikipedia page',
          description: `${competitorsWithWikipedia.length} of your top competitors have Wikipedia pages. ChatGPT frequently cites Wikipedia as an authoritative source.`,
          impact: '+20-30% visibility',
          effort: 'high',
          steps: [
            'Verify your company meets Wikipedia notability guidelines (significant press coverage, awards, funding)',
            'Gather 3-5 reliable secondary sources (news articles, industry publications)',
            'Draft article following Wikipedia\'s neutral point of view and style guidelines',
            'Create a Wikipedia account and submit article for review',
            'Monitor and maintain the page with regular updates'
          ],
          evidence: {
            competitorExamples: competitorsWithWikipedia,
            sourceUrls: sourceTypes.wikipedia.slice(0, 2),
            mentionCount: simulationResults.filter((r: any) => 
              r.sources?.some((s: any) => s.url.includes('wikipedia'))
            ).length,
          },
        });
      }
    }

    // ACTION 2: Review site presence
    if ((sourceTypes.g2.length > 0 || sourceTypes.capterra.length > 0) && yourVisibility < 60) {
      const reviewSites = [...new Set([...sourceTypes.g2, ...sourceTypes.capterra])];
      const competitorsOnReviewSites = topCompetitors
        .filter(([_, stats]) => Array.from(stats.sources).some(s => s.includes('g2') || s.includes('capterra')))
        .map(([name]) => name);

      if (competitorsOnReviewSites.length > 0) {
        actions.push({
          id: `action-${actionId++}`,
          priority: 'high',
          category: 'source_presence',
          title: 'Get listed on review platforms (G2, Capterra)',
          description: `Competitors are getting mentioned because they have strong presence on review sites. ChatGPT uses these as trusted sources.`,
          impact: '+15-25% visibility',
          effort: 'medium',
          steps: [
            'Claim your company profile on G2.com and Capterra',
            'Optimize your profile with complete information, screenshots, and videos',
            'Launch a review collection campaign to get 10+ verified reviews',
            'Respond to all reviews professionally',
            'Add review badges to your website to build authority'
          ],
          evidence: {
            competitorExamples: competitorsOnReviewSites,
            sourceUrls: reviewSites.slice(0, 2),
            frequency: reviewSites.length,
          },
        });
      }
    }

    // ACTION 3: Comparison content
    const comparisonQueries = simulationResults.filter((r: any) => 
      r.brandSourceMappings?.some((m: any) => m.contentType === 'comparison')
    );

    if (comparisonQueries.length > 0 && yourMentions < totalResults * 0.5) {
      const competitorsInComparisons = new Set<string>();
      comparisonQueries.forEach((r: any) => {
        r.mentionedBrands?.forEach((b: any) => {
          if (b.name !== yourBrand) competitorsInComparisons.add(b.name);
        });
      });

      actions.push({
        id: `action-${actionId++}`,
        priority: 'high',
        category: 'content_creation',
        title: 'Create comparison pages',
        description: `ChatGPT mentions competitors in "${comparisonQueries.length}" comparison queries. Create dedicated comparison content to appear in these searches.`,
        impact: '+10-20% visibility',
        effort: 'medium',
        steps: [
          `Create "${yourBrand} vs [Competitor]" pages for top 3 competitors`,
          'Include detailed feature comparison tables',
          'Add pricing comparisons and use case recommendations',
          'Optimize pages for SEO with comparison keywords',
          'Promote comparison pages through your marketing channels'
        ],
        evidence: {
          competitorExamples: Array.from(competitorsInComparisons).slice(0, 3),
          queryExamples: comparisonQueries.slice(0, 3).map((r: any) => r.query),
          frequency: comparisonQueries.length,
        },
      });
    }

    // ACTION 4: Topic coverage gaps
    const selectedTopics = topics.filter((t: any) => t.selected);
    const weakTopics = selectedTopics.filter((topic: any) => {
      const topicResults = simulationResults.filter((r: any) =>
        r.query.toLowerCase().includes(topic.name.toLowerCase().split(' ').slice(0, 2).join(' '))
      );
      const topicMentions = topicResults.filter((r: any) => r.yourBrandMentioned).length;
      return topicResults.length > 0 && (topicMentions / topicResults.length) < 0.3;
    });

    if (weakTopics.length > 0) {
      actions.push({
        id: `action-${actionId++}`,
        priority: 'medium',
        category: 'topic_coverage',
        title: `Improve content for ${weakTopics.length} weak topics`,
        description: `You appear in less than 30% of queries for these topics. Competitors are dominating this space.`,
        impact: '+15-20% visibility',
        effort: 'medium',
        steps: [
          'Create comprehensive guides for each weak topic',
          'Include real examples, case studies, and best practices',
          'Optimize content with relevant keywords and structured data',
          'Publish on your blog and promote through social channels',
          'Build backlinks from authoritative sites in your industry'
        ],
        evidence: {
          queryExamples: weakTopics.slice(0, 3).map((t: any) => `Best tools for ${t.name}`),
          frequency: weakTopics.length,
        },
      });
    }

    // ACTION 5: "Best of" list content
    const bestOfQueries = simulationResults.filter((r: any) =>
      r.brandSourceMappings?.some((m: any) => m.contentType === 'list')
    );

    if (bestOfQueries.length > 2 && yourMentions < totalResults * 0.4) {
      actions.push({
        id: `action-${actionId++}`,
        priority: 'medium',
        category: 'content_creation',
        title: 'Create "best of" and listicle content',
        description: `ChatGPT frequently references "best tools" and "top solutions" lists. Create this content to get included.`,
        impact: '+10-15% visibility',
        effort: 'low',
        steps: [
          'Create "Best [Category] Tools in 2024" articles including your product',
          'Be objective and include competitors to build trust',
          'Add detailed criteria and comparison matrices',
          'Optimize for featured snippets with clear headings',
          'Update annually to maintain relevance'
        ],
        evidence: {
          queryExamples: bestOfQueries.slice(0, 3).map((r: any) => r.query),
          frequency: bestOfQueries.length,
        },
      });
    }

    // ACTION 6: Blog and content marketing
    if (sourceTypes.blogs.length > 0 && yourVisibility < 50) {
      actions.push({
        id: `action-${actionId++}`,
        priority: 'medium',
        category: 'content_creation',
        title: 'Publish on high-authority blogs',
        description: `Competitors are getting mentioned through blog posts on Medium, TechCrunch, and industry blogs. Guest posting builds authority.`,
        impact: '+10-15% visibility',
        effort: 'medium',
        steps: [
          'Identify top industry blogs and publications in your space',
          'Pitch guest post ideas that provide genuine value',
          'Write in-depth articles (1500+ words) with expert insights',
          'Include natural mentions of your product where relevant',
          'Build relationships with editors for ongoing opportunities'
        ],
        evidence: {
          sourceUrls: sourceTypes.blogs.slice(0, 2),
          frequency: sourceTypes.blogs.length,
        },
      });
    }

    // Generate AI summary of overall strategy
    const summaryPrompt = `Based on this analysis:
- Your brand visibility: ${yourVisibility.toFixed(1)}%
- Top competitor: ${topCompetitors[0]?.[0]} with ${topCompetitors[0]?.[1].mentions} mentions
- Total actions recommended: ${actions.length}

Write a 2-3 sentence executive summary of the key strategy to improve AI visibility.`;

    const summaryCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a strategic advisor for AI visibility. Be concise and actionable.",
        },
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const strategySummary = summaryCompletion.choices[0]?.message?.content?.trim() || 
      "Focus on building authoritative presence across key sources where competitors are strong.";

    return NextResponse.json({
      success: true,
      actions,
      summary: {
        totalActions: actions.length,
        highPriority: actions.filter(a => a.priority === 'high').length,
        mediumPriority: actions.filter(a => a.priority === 'medium').length,
        lowPriority: actions.filter(a => a.priority === 'low').length,
        estimatedImpact: yourVisibility < 30 ? '+40-60% visibility' : 
                         yourVisibility < 50 ? '+25-40% visibility' : '+15-25% visibility',
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
