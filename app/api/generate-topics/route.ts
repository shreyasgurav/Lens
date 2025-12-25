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
          content: `Generate prompts that users ask AI assistants to DISCOVER and GET RECOMMENDATIONS for products.

THE ONE RULE:
Every prompt must make AI respond with a LIST of recommended products/brands.

User asks → AI responds with: "Here are some options: Product A, Product B, Product C..."

═══════════════════════════════════════
VALID PROMPT TYPES (use these patterns)
═══════════════════════════════════════

1. RECOMMENDATION REQUESTS (40%)
   "What's the best [product type] for [use case]?"
   "Which [product type] would you recommend for [situation]?"
   "Top [product type] for [specific need]?"
   
2. NEED/PROBLEM STATEMENTS (30%)
   "I need a tool to [do something]"
   "Looking for [product type] that can [capability]"
   "I want to [achieve goal], what should I use?"
   
3. FEATURE-BASED DISCOVERY (20%)
   "[Product type] with [specific feature]"
   "[Product type] that integrates with [tool]"
   "Free/affordable [product type] for [use case]"
   
4. ALTERNATIVE REQUESTS (10%)
   "Alternatives to [FAMOUS well-known competitor only]"
   "Something like [FAMOUS brand] but cheaper/better"

═══════════════════════════════════════
STRICT RULES
═══════════════════════════════════════

- Generate EXACTLY 10 prompts
- NEVER mention "${companyName}" - users don't know about it yet
- NEVER mention any brand names EXCEPT in "alternatives to [famous brand]"
- NO comparison questions like "X vs Y" or "How does X compare to Y"
- NO questions about downsides/limitations
- NO educational/tutorial questions
- Every prompt = AI will list product recommendations
- Sound like real humans (casual, conversational)
- Mix short (5-8 words) and medium (10-15 words) prompts
- Return ONLY a JSON array of strings

═══════════════════════════════════════
❌ BAD - AI won't list products
═══════════════════════════════════════
- "Zoom vs Teams for meetings" (compares 2 specific products)
- "What are downsides of AI meeting tools?" (lists downsides, not products)
- "How does Notion compare to..." (asks about specific brand)
- "Is Slack suitable for enterprise?" (asks about specific brand)
- "What features make X stand out?" (asks about specific brand)

═══════════════════════════════════════
✅ GOOD - AI will list products
═══════════════════════════════════════
- "What's the best meeting assistant for remote teams?"
- "I need a tool to automatically take meeting notes"
- "Recommend a video conferencing tool for small teams"
- "Meeting software with transcription features"
- "Affordable project management tool for startups"
- "Alternatives to Zoom for video calls"
- "Looking for a CRM that integrates with Gmail"`,
        },
        {
          role: "user",
          content: `Company: ${companyName}
Description: ${description}${categoryContext}${featureContext}${keywordContext}

Generate 10 prompts that users would ask AI to DISCOVER products like this. Each prompt should make AI respond with a list of product recommendations (where ${companyName} could potentially appear).`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
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
