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

    // Build context
    const featureContext = scrapedFeatures?.length 
      ? `\nKey Features: ${scrapedFeatures.slice(0, 6).join(", ")}`
      : "";
    const categoryContext = category ? `\nCategory: ${category}` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are part of a Generative Engine Optimization (GEO) platform that helps brands appear in AI responses (ChatGPT, Perplexity, Gemini, Claude).

YOUR ROLE:
You are the first step in brand onboarding. Your job is to generate the exact search questions that potential customers type into AI assistants when they are looking for products, software, or services like this brand offers.

WHY THIS MATTERS:
These questions will be used to simulate AI responses and understand:
- Which competitors currently appear for these searches
- What claims competitors own in AI responses
- Where this brand is missing from AI recommendations
- What content and outreach is needed to improve visibility

YOUR TASK:
Generate 10 realistic search questions that a potential customer would ask an AI assistant when they are:
- Looking for a solution to a problem this brand solves
- Searching for software/products in this category
- Trying to find alternatives or recommendations

THE CUSTOMER:
- Does NOT know this brand exists yet
- Is actively searching for a solution
- Types naturally into ChatGPT like they're asking a friend
- Wants recommendations, not tutorials

QUESTION STYLES (mix these):
- "Best [software/product] for [use case]"
- "What's a good [tool] for [task]?"
- "I need a [product] that can [do something]"
- "[Category] software for [industry/team]"
- "Tool to help with [problem]"
- "Alternatives to [well-known competitor]"

STRICT RULES:
- Generate EXACTLY 10 questions
- NEVER mention "${companyName}" - the customer doesn't know it exists
- Sound like a real person, not a marketer or analyst
- Keep questions simple and natural (5-20 words each)
- Focus on problems and use cases from the description
- Brand names only allowed in "alternatives to X" style questions
- No jargon, no buzzwords, no corporate language

OUTPUT:
Return ONLY a JSON array of 10 question strings. No explanations.`,
        },
        {
          role: "user",
          content: `BRAND TO ONBOARD: ${companyName} (DO NOT mention this name in any question)

WHAT THIS BRAND DOES:
${description}
${categoryContext}${featureContext}

Generate 10 search questions that potential customers would type into ChatGPT when looking for a product/software like this. These questions will be used to simulate AI responses and analyze competitor visibility.`,
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "[]";
    
    let topics: string[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch {
      topics = responseText
        .split("\n")
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^[\d\-\.\)]+\s*/, "").replace(/["\[\]]/g, "").trim())
        .filter((line: string) => line.length > 5)
        .slice(0, 10);
    }

    // Filter out any that mention company name
    const companyLower = companyName.toLowerCase();
    topics = topics
      .filter((t: string) => typeof t === "string" && t.length > 5 && !t.toLowerCase().includes(companyLower))
      .slice(0, 10);

    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error("Error generating topics:", error);
    return NextResponse.json({ success: false, error: "Failed to generate topics" }, { status: 500 });
  }
}
