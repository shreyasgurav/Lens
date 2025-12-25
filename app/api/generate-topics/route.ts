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
          content: `You are a search behavior expert who understands how people discover products through AI assistants like ChatGPT.

Your job: Generate PRODUCT DISCOVERY queries - the exact searches people type when looking for tools/products/services like this one.

CRITICAL MINDSET:
- Think like someone searching for a product recommendation
- Adapt to the product type (SaaS tool, platform, service, marketplace, etc.)
- Only use "AI" if the product is actually AI-focused
- Focus on what the product DOES, not just AI features
- These are DISCOVERY queries that lead to product recommendations

QUERY TYPES TO GENERATE:

1. **Best/Top searches** (60%): "Best [product type] for [use case]", "Top [platform/tool] for [task]"
   Examples: 
   - For video platform: "Best video sharing platform for creators", "Top video hosting site for businesses"
   - For AI tool: "Best AI meeting assistant", "Top AI note taker"
   - For marketplace: "Best online marketplace for sellers", "Top e-commerce platform"

2. **Capability/Feature searches** (25%): "[Product type] with [feature]", "[Capability] platform/tool"
   Examples:
   - For video platform: "Video platform with monetization", "Live streaming platform for events"
   - For AI tool: "AI that can transcribe meetings", "Automated note taking tool"

3. **Use case specific** (10%): "[Product type] for [role/industry]", "[Feature] for [scenario]"
   Examples: "Video hosting for educators", "Meeting tool for remote teams"

4. **Alternative/Comparison** (5%): "Alternative to [popular competitor]"
   Examples: "Alternative to YouTube", "Alternative to Zoom"

CRITICAL RULES:
- Generate exactly 10 queries
- Adapt language to the product type (don't force "AI" everywhere)
- For platforms/services: focus on use cases and features
- For AI tools: emphasize AI capabilities
- Use keywords: "best", "top", "[product type]", "for [use case]", "with [feature]"
- NO brand names (except in "alternative to X")
- Queries should be 3-8 words
- Return ONLY a JSON array of strings

✅ GOOD EXAMPLES (Video Platform):
- "Best video sharing platform for creators"
- "Top video hosting site for businesses"
- "Video platform with monetization"
- "Best live streaming platform"
- "Video hosting for educators"
- "Alternative to YouTube"

✅ GOOD EXAMPLES (AI Meeting Tool):
- "Best AI meeting assistant"
- "AI that can transcribe meetings"
- "Top meeting note taker"
- "Automated meeting summaries tool"

❌ BAD EXAMPLES:
- "How to make better videos" (problem-focused)
- "YouTube tutorial" (brand-specific)
- "AI video platform" (forcing AI where it doesn't fit)`,
        },
        {
          role: "user",
          content: `Company: ${companyName}
Description: ${description}${categoryContext}${featureContext}${keywordContext}

Based on this SPECIFIC product, generate 10 highly targeted AI search topics that potential customers would search for:`,
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
