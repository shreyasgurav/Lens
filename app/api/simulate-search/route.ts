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
      model: "gpt-4o",
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
      temperature: 0.3,
    });

    const query = queryGeneration.choices[0]?.message?.content?.trim() || topic;

    // Simulate the AI response using GPT-4o (Most reliable for simulation)
    const responseCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are ChatGPT, a helpful AI assistant answering questions about software and tools.

IMPORTANT RULES:
- Provide helpful recommendations with 3-5 specific tools/products by name
- Always mention real products that exist in the market
- Be specific about what each product does and its key features
- Format as a conversational response, NOT a numbered list
- Include both well-known and emerging tools in the space`,
        },
        {
          role: "user",
          content: query,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = responseCompletion.choices[0]?.message?.content?.trim() || "";
    
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

    // Generate realistic sources using actual working URLs
    // Extract category/keywords from query for better source matching
    const queryLower = query.toLowerCase();
    
    // Define real, working source URLs by category
    const sourceTemplates = [
      // Review sites
      { title: "Software Reviews & Ratings - G2", url: "https://www.g2.com" },
      { title: "Software Reviews - Capterra", url: "https://www.capterra.com" },
      { title: "Business Software Reviews - TrustRadius", url: "https://www.trustradius.com" },
      { title: "Software Advice & Reviews", url: "https://www.softwareadvice.com" },
      
      // Tech news
      { title: "Tech News & Startup Coverage - TechCrunch", url: "https://techcrunch.com" },
      { title: "Technology News - The Verge", url: "https://www.theverge.com" },
      { title: "Tech Industry News - VentureBeat", url: "https://venturebeat.com" },
      { title: "Product Launches - Product Hunt", url: "https://www.producthunt.com" },
      
      // Business publications
      { title: "Business & Technology - Forbes", url: "https://www.forbes.com/technology" },
      { title: "Business Innovation - Fast Company", url: "https://www.fastcompany.com" },
      { title: "Startup & Business News - Inc.", url: "https://www.inc.com" },
      
      // Developer/Tech communities
      { title: "Developer Community - Dev.to", url: "https://dev.to" },
      { title: "Tech Discussions - Hacker News", url: "https://news.ycombinator.com" },
      { title: "Developer Q&A - Stack Overflow", url: "https://stackoverflow.com" },
      
      // General knowledge
      { title: "Wikipedia", url: "https://en.wikipedia.org" },
      { title: "Technology Insights - Medium", url: "https://medium.com/tag/technology" },
    ];
    
    // Randomly select 3-4 diverse sources
    const shuffled = sourceTemplates.sort(() => 0.5 - Math.random());
    const sources = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

    // Extract ALL brand mentions from the response (not just known ones)
    const brandExtraction = await openai.chat.completions.create({
      model: "gpt-4o",
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

    // Check known brands first
    for (const brand of allBrands) {
      if (isBrandMentioned(brand, response)) {
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
