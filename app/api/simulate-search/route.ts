import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SimulationResult {
  query: string;
  response: string;
  brands: {
    name: string;
    position: number | null;
    sentiment: string;
    ranked: boolean;
  }[];
  sources?: {
    url: string;
    title: string;
  }[];
  lowConfidence?: boolean;
  confidenceReason?: string;
}

interface BrandSourceMapping {
  brand: string;
  mentionedInSources: string[];
  contentType: 'comparison' | 'review' | 'list' | 'tutorial' | 'general';
  prominence: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, companyName, description, competitors } = body;

    console.log('Simulate search request:', { topic, companyName, competitorsCount: competitors?.length });

    if (!companyName || !topic) {
      console.error('Missing fields:', { companyName: !!companyName, topic: !!topic, competitors: !!competitors });
      return NextResponse.json(
        { success: false, error: "Missing required fields", received: { companyName: !!companyName, topic: !!topic, competitors: !!competitors } },
        { status: 400 }
      );
    }

    // Ensure competitors is an array
    const competitorsList = Array.isArray(competitors) ? competitors : [];

    // Topics are already in question format from generate-topics, use directly
    const allBrands = [companyName, ...competitorsList];
    const results = [];

    console.log('Processing simulation for:', { query: topic, brandsCount: allBrands.length });

    // Use topic directly as query (already in question format)
    const query = topic.trim();

    // Use Responses API with web_search_preview tool for real web search
    let responseCompletion;
    try {
      responseCompletion = await openai.responses.create({
        model: "gpt-5",
        reasoning: { effort: "low" },
        tools: [
          { 
            type: "web_search_preview" as any
          }
        ],
        input: query,
      } as any);
    } catch (error) {
      console.error('Web search failed, falling back to standard completion:', error);
      // Fallback to standard GPT-5 if web search fails
      const fallbackCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are ChatGPT answering questions about software and tools. Provide helpful recommendations with 3-5 specific tools/products by name. Format as a conversational response with clear recommendations.`
          },
          { role: "user", content: query }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      
      const fallbackResponse = fallbackCompletion.choices[0]?.message?.content?.trim() || "";
      
      return NextResponse.json({
        success: true,
        results: [{
          query,
          response: fallbackResponse,
          mentionedBrands: [],
          yourBrandMentioned: false,
          yourBrandPosition: null,
          sources: [],
          brandSourceMappings: [],
          lowConfidence: true,
          confidenceReason: "Web search unavailable - using standard AI response"
        }]
      });
    }

    const response = responseCompletion.output_text || "";
    
    // Extract sources from web search results
    const webSearchSources: { url: string; title: string }[] = [];
    
    if (responseCompletion.output && Array.isArray(responseCompletion.output)) {
      for (const item of responseCompletion.output) {
        // Find web_search_call items with sources
        if (item.type === 'web_search_call' && (item as any).action?.sources) {
          for (const source of (item as any).action.sources) {
            if (source.url && source.title) {
              webSearchSources.push({
                url: source.url,
                title: source.title
              });
            }
          }
        }
        // Also extract from message annotations
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if ((content as any).annotations) {
              for (const annotation of (content as any).annotations) {
                if (annotation.type === 'url_citation' && annotation.url && annotation.title) {
                  webSearchSources.push({
                    url: annotation.url,
                    title: annotation.title
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Log for debugging
    console.log('GPT-4o Response:', {
      query,
      responseLength: response.length,
      responsePreview: response.substring(0, 200)
    });
    
    // If response is empty, provide fallback
    if (!response) {
      console.error('Empty response from GPT-5.2');
    }

    // Use ONLY real sources from web search - never fake them
    const sources = webSearchSources.length > 0 ? webSearchSources : [];
    const lowConfidence = sources.length === 0;
    const confidenceReason = lowConfidence ? "AI response not grounded in explicit web citations" : undefined;
    
    console.log('Web search sources found:', sources.length, sources.map(s => s.url));
    if (lowConfidence) {
      console.log('⚠️ Low confidence simulation - no web sources found');
    }

    // Extract brands WITH RANKING from structured response
    const brandExtraction = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Extract all product/company names from the text IN THE ORDER they are recommended.

Look for:
- Numbered lists (1., 2., 3.)
- Bullet points with clear ordering
- Phrases like "Top picks", "Best options", "I recommend"
- First mentioned = higher priority

Return JSON:
{
  "rankedBrands": ["Brand1", "Brand2", ...],
  "unrankedBrands": ["BrandX", ...]
}

rankedBrands = clearly ordered recommendations
unrankedBrands = mentioned but not explicitly recommended`,
        },
        {
          role: "user",
          content: response,
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    let rankedBrands: string[] = [];
    let unrankedBrands: string[] = [];
    
    try {
      const brandText = brandExtraction.choices[0]?.message?.content?.trim() || "{}";
      const jsonMatch = brandText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        rankedBrands = parsed.rankedBrands || [];
        unrankedBrands = parsed.unrankedBrands || [];
      }
    } catch (e) {
      console.error("Failed to parse extracted brands:", e);
      // Fallback: try to extract as simple array
      try {
        const brandText = brandExtraction.choices[0]?.message?.content?.trim() || "[]";
        const arrayMatch = brandText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          rankedBrands = JSON.parse(arrayMatch[0]);
        }
      } catch {}
    }

    // Build mentioned brands list with PROPER RANKING
    const mentionedBrands: Array<{
      name: string;
      position: number | null;
      sentiment: string;
      isKnown: boolean;
      ranked: boolean;
    }> = [];

    // Helper function to check if brand is mentioned (handles variations)
    const isBrandMentioned = (brand: string, text: string): boolean => {
      const textLower = text.toLowerCase();
      const brandLower = brand.toLowerCase();
      
      // Direct match
      if (textLower.includes(brandLower)) return true;
      
      // Handle "brand.ai" → "brand" and "brand ai"
      const brandBase = brandLower.replace(/\.(ai|io|com|co|app|so)$/i, '').replace(/\s+(ai|io)$/i, '');
      if (brandBase && textLower.includes(brandBase)) return true;
      
      // Handle "Otter.ai" matching "Otter AI" or "Otter"
      const brandWithSpace = brandBase + ' ai';
      if (textLower.includes(brandWithSpace)) return true;
      
      // Word boundary check
      try {
        const regex = new RegExp(`\\b${escapeRegex(brand)}\\b`, "gi");
        if (regex.test(text)) return true;
        
        // Also check base name
        if (brandBase && brandBase.length > 2) {
          const baseRegex = new RegExp(`\\b${escapeRegex(brandBase)}\\b`, "gi");
          if (baseRegex.test(text)) return true;
        }
      } catch (e) {
        // Ignore regex errors
      }
      
      return false;
    };

    // Process RANKED brands first (these have explicit positions)
    rankedBrands.forEach((brand, index) => {
      // Check if it's a known brand (yours or competitor)
      const isKnown = allBrands.some(b => b.toLowerCase() === brand.toLowerCase());
      
      mentionedBrands.push({
        name: brand,
        position: index + 1,
        sentiment: "neutral",
        isKnown,
        ranked: true,
      });
    });

    // Process UNRANKED brands (mentioned but not in recommendation list)
    unrankedBrands.forEach(brand => {
      // Skip if already in ranked list
      if (rankedBrands.some(rb => rb.toLowerCase() === brand.toLowerCase())) return;
      
      const isKnown = allBrands.some(b => b.toLowerCase() === brand.toLowerCase());
      
      mentionedBrands.push({
        name: brand,
        position: null,
        sentiment: "neutral",
        isKnown,
        ranked: false,
      });
    });
    
    // Check for known brands that weren't extracted but are mentioned in text
    for (const brand of allBrands) {
      const alreadyListed = mentionedBrands.some(mb => mb.name.toLowerCase() === brand.toLowerCase());
      if (!alreadyListed && isBrandMentioned(brand, response)) {
        mentionedBrands.push({
          name: brand,
          position: null,
          sentiment: "neutral",
          isKnown: true,
          ranked: false,
        });
      }
    }

    // Check if your brand was mentioned
    const yourBrandMentioned = mentionedBrands.some(
      b => b.name.toLowerCase() === companyName.toLowerCase()
    );
    const yourBrandPosition = mentionedBrands.find(
      b => b.name.toLowerCase() === companyName.toLowerCase()
    )?.position || null;
    
    console.log('Brand detection:', {
      companyName,
      yourBrandMentioned,
      yourBrandPosition,
      totalBrandsMentioned: mentionedBrands.length,
      brandNames: mentionedBrands.map(b => b.name)
    });

    // Analyze brand-source relationships
    const brandSourceMappings: BrandSourceMapping[] = [];
    
    for (const brand of mentionedBrands) {
      // Determine which sources likely mention this brand
      const brandSources: string[] = [];
      
      // Check if brand appears in source titles/URLs
      sources.forEach(source => {
        const lowerTitle = source.title.toLowerCase();
        const lowerUrl = source.url.toLowerCase();
        const lowerBrand = brand.name.toLowerCase();
        
        if (lowerTitle.includes(lowerBrand) || lowerUrl.includes(lowerBrand.replace(/\s+/g, ''))) {
          brandSources.push(source.url);
        }
      });
      
      // If no direct match, assume brand is mentioned in general sources
      if (brandSources.length === 0 && sources.length > 0) {
        brandSources.push(sources[0].url); // First source as fallback
      }
      
      // Determine content type from query and response
      let contentType: BrandSourceMapping['contentType'] = 'general';
      const lowerQuery = query.toLowerCase();
      const lowerResponse = response.toLowerCase();
      
      if (lowerQuery.includes('vs') || lowerQuery.includes('compare') || lowerResponse.includes('comparison')) {
        contentType = 'comparison';
      } else if (lowerQuery.includes('review') || lowerResponse.includes('review')) {
        contentType = 'review';
      } else if (lowerQuery.includes('best') || lowerQuery.includes('top') || lowerResponse.includes('best')) {
        contentType = 'list';
      } else if (lowerQuery.includes('how to') || lowerQuery.includes('tutorial')) {
        contentType = 'tutorial';
      }
      
      // Determine prominence based on position
      const prominence: BrandSourceMapping['prominence'] = 
        brand.position !== null && brand.position <= 2 ? 'high' : 
        brand.position !== null && brand.position <= 4 ? 'medium' : 'low';
      
      brandSourceMappings.push({
        brand: brand.name,
        mentionedInSources: brandSources,
        contentType,
        prominence,
      });
    }

    results.push({
      query,
      response,
      mentionedBrands,
      yourBrandMentioned,
      yourBrandPosition,
      sources,
      brandSourceMappings,
      lowConfidence,
      confidenceReason,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error simulating search:", error);
    return NextResponse.json(
      { success: false, error: "Failed to simulate search" },
      { status: 500 }
    );
  }
}

// Helper to escape regex special characters
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
