import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { description, companyName, category, scrapedFeatures, scrapedKeywords } = await request.json();

    if (!description || !companyName) {
      return NextResponse.json(
        { success: false, error: "Missing description or companyName" },
        { status: 400 }
      );
    }

    // Build context from scraped data
    const featureContext = scrapedFeatures?.length 
      ? `\nActual Product Features: ${scrapedFeatures.join(", ")}`
      : "";
    const keywordContext = scrapedKeywords?.length
      ? `\nWebsite Keywords: ${scrapedKeywords.join(", ")}`
      : "";
    const categoryContext = category
      ? `\nProduct Category: ${category}`
      : "";

    // Generate topics using OpenAI with richer context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at understanding how potential customers ask questions to AI assistants like ChatGPT, Claude, or Perplexity when looking for product recommendations.

Your job: Generate REALISTIC CUSTOMER PROMPTS - the actual questions/prompts people would ask an AI assistant when looking for products/services like this one.

CRITICAL MINDSET:
- These are conversational questions people ask AI assistants
- Think like someone seeking recommendations or solutions
- Adapt to the product type (SaaS, platform, service, marketplace, etc.)
- Questions should feel natural and conversational
- Mix of short and detailed prompts
- Focus on problems, use cases, and recommendations

PROMPT TYPES TO GENERATE:

1. **Recommendation Requests** (40%): "What's the best [product] for [use case]?", "Can you recommend a [tool] that [does X]?"
   Examples:
   - "What's the best video platform for content creators?"
   - "Can you recommend a meeting tool that records and transcribes?"
   - "What's a good e-commerce platform for small businesses?"

2. **Problem-Solution** (30%): "I need [solution] for [problem]", "Looking for [tool] to help with [task]"
   Examples:
   - "I need a way to share videos with my team"
   - "Looking for a tool to automate meeting notes"
   - "I want to start selling online, what platform should I use?"

3. **Comparison/Alternative** (15%): "What are alternatives to [competitor]?", "[Product A] vs [Product B]"
   Examples:
   - "What are alternatives to YouTube for creators?"
   - "Zoom vs other meeting platforms"

4. **Feature-Specific** (15%): "[Product type] with [specific feature]", "Does [product] have [capability]?"
   Examples:
   - "Video platform with built-in monetization"
   - "Meeting tool that integrates with Slack"

CRITICAL RULES:
- Generate exactly 10 prompts
- Make them conversational and natural (how people actually talk to AI)
- Vary length: some short (5-8 words), some detailed (10-15 words)
- Adapt to product type - don't force "AI" if not relevant
- Include question marks where appropriate
- NO brand names (except in "alternative to X" or comparisons)
- Return ONLY a JSON array of strings

✅ GOOD EXAMPLES (Video Platform):
- "What's the best video platform for content creators?"
- "I need a way to host and share videos for my business"
- "Video platform with monetization features"
- "What are alternatives to YouTube?"
- "Looking for a video hosting solution for online courses"

✅ GOOD EXAMPLES (AI Meeting Tool):
- "What's the best AI tool for meeting notes?"
- "I need something to automatically transcribe my meetings"
- "Can you recommend a meeting assistant that works with Zoom?"
- "Looking for an AI note taker for remote teams"

✅ GOOD EXAMPLES (E-commerce):
- "What's the best platform to start an online store?"
- "I want to sell products online, what should I use?"
- "E-commerce platform for small businesses"
- "What are alternatives to Shopify?"

❌ BAD EXAMPLES:
- "How to make videos" (too generic, not product-focused)
- "YouTube tutorial" (not a recommendation request)
- "Best AI video tool" (forcing AI where it doesn't fit)`,
        },
        {
          role: "user",
          content: `Company: ${companyName}
Description: ${description}${categoryContext}${featureContext}${keywordContext}

Based on this SPECIFIC product, generate 10 realistic customer prompts/questions that potential customers would ask an AI assistant when looking for this type of product:`,
        },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "[]";
    
    // Parse the JSON array from the response
    let topics: string[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback: split by newlines if JSON parsing fails
      topics = responseText
        .split("\n")
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^[\d\-\.\)]+\s*/, "").replace(/["\[\]]/g, "").trim())
        .filter((line: string) => line.length > 5)
        .slice(0, 10);
    }

    // Validate and clean topics
    topics = topics
      .filter((t: string) => typeof t === "string" && t.length > 5 && t.length < 100)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      topics,
    });
  } catch (error) {
    console.error("Error generating topics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate topics" },
      { status: 500 }
    );
  }
}
