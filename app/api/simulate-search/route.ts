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
    position: number;
    sentiment: string;
  }[];
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

    // Generate prompts for this topic
    const allBrands = [companyName, ...competitorsList];
    const results = [];

    console.log('Processing simulation for:', { query: topic, brandsCount: allBrands.length });

    // Generate 1 natural question from this topic
    const queryGeneration = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a search query expert. Convert topics into natural questions that users would ask ChatGPT.

Rules:
- Make it conversational and natural
- Focus on recommendations/comparisons
- Keep it 10-20 words
- Return ONLY the question, no explanation

Examples:
"AI meeting assistant" → "What are the best AI meeting assistants for professionals?"
"Project management tools" → "Which project management tools should I use for my team?"
"Email marketing software" → "What's the best email marketing software for small businesses?"`,
        },
        {
          role: "user",
          content: `Topic: ${topic}\n\nGenerate a natural search question:`,
        },
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const query = queryGeneration.choices[0]?.message?.content?.trim() || topic;

    // Simulate the AI response
    const responseCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are ChatGPT, a helpful AI assistant. Answer user questions about software and tools naturally.

When users ask for recommendations, provide a helpful list of 3-5 relevant tools/products.
Include well-known products in the space and be specific about their capabilities.
Format your response conversationally, mentioning products by name.`,
        },
        {
          role: "user",
          content: query,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const response = responseCompletion.choices[0]?.message?.content?.trim() || "";

    // Generate realistic source URLs based on response content
    const sourceGeneration = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a source citation expert. Based on the AI response, generate 3-4 realistic web sources where this information would come from.

CRITICAL RULES:
- Return ONLY a JSON array of objects with "title" and "url" fields
- Sources should be DIVERSE: blogs, review sites, comparison articles, industry publications
- Include a mix of:
  * Review/comparison sites (G2, Capterra, TrustRadius, Software Advice)
  * Tech blogs (TechCrunch, VentureBeat, The Verge, Product Hunt)
  * Industry publications (Forbes, Inc, Fast Company)
  * Specialized blogs (Medium, Dev.to, Hacker News)
  * Wikipedia for general topics
- Make URLs realistic and specific to the query topic
- Titles should match what a real article would be called
- DO NOT just use company websites - use THIRD-PARTY sources

GOOD EXAMPLES:
[
  {"title": "Best AI Meeting Assistants for 2024 - G2", "url": "https://www.g2.com/categories/ai-meeting-assistants"},
  {"title": "Top 10 AI Note-Taking Tools Compared - TechCrunch", "url": "https://techcrunch.com/2024/ai-meeting-tools-comparison"},
  {"title": "AI Meeting Tools: A Complete Guide - Medium", "url": "https://medium.com/productivity/ai-meeting-tools-guide"}
]

BAD EXAMPLES:
[
  {"title": "Otter.ai Homepage", "url": "https://otter.ai"},
  {"title": "ChatGPT Knowledge", "url": "https://chat.openai.com"}
]`,
        },
        {
          role: "user",
          content: `Query: ${query}\n\nResponse: ${response}\n\nGenerate 3-4 realistic web sources (blogs, reviews, comparisons):`,
        },
      ],
      max_tokens: 300,
      temperature: 0.4,
    });

    let sources: Array<{title: string; url: string}> = [];
    try {
      const sourcesText = sourceGeneration.choices[0]?.message?.content?.trim() || "[]";
      const jsonMatch = sourcesText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        sources = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse sources:", e);
      // Fallback to generic but realistic sources
      sources = [
        { title: "Industry Research & Reviews", url: "https://www.g2.com" },
        { title: "Tech News & Analysis", url: "https://techcrunch.com" },
        { title: "Product Comparisons", url: "https://www.capterra.com" }
      ];
    }

    // Extract ALL brand mentions from the response (not just known ones)
    const brandExtraction = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract all product/company names mentioned in the text. Return ONLY a JSON array of brand names.
Example: ["Notion", "Asana", "Monday.com"]`,
        },
        {
          role: "user",
          content: response,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    let extractedBrands: string[] = [];
    try {
      const brandText = brandExtraction.choices[0]?.message?.content?.trim() || "[]";
      const jsonMatch = brandText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedBrands = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse extracted brands:", e);
    }

    // Build mentioned brands list with positions
    const mentionedBrands = [];
    let position = 1;

    // Check known brands first
    for (const brand of allBrands) {
      const regex = new RegExp(`\\b${escapeRegex(brand)}\\b`, "gi");
      if (regex.test(response)) {
        mentionedBrands.push({
          name: brand,
          position,
          sentiment: "neutral",
          isKnown: true,
        });
        position++;
      }
    }

    // Add newly discovered brands
    for (const brand of extractedBrands) {
      if (!allBrands.some(b => b.toLowerCase() === brand.toLowerCase())) {
        mentionedBrands.push({
          name: brand,
          position,
          sentiment: "neutral",
          isKnown: false,
        });
        position++;
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
        brand.position <= 2 ? 'high' : brand.position <= 4 ? 'medium' : 'low';
      
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
