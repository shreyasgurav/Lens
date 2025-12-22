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
          content: `You are a search behavior expert who understands how people discover software products through AI assistants.

Your job: Generate PRODUCT DISCOVERY queries - the exact searches people type when looking for tools/products like this one.

CRITICAL MINDSET:
- Think like someone who knows they need a TOOL but doesn't know which one yet
- Focus on "Best [tool type]" and "AI [capability]" searches
- These are DISCOVERY queries, not problem statements
- Write queries that would naturally lead to product recommendations

QUERY TYPES TO GENERATE:

1. **Best/Top searches** (50%): "Best [tool type] for [use case]", "Top [AI tool] for [task]"
   Examples: "Best AI note taker for meetings", "Top AI assistant for video calls", "Best meeting transcription tool"

2. **AI capability searches** (30%): "AI that can [capability]", "AI [tool type]", "[AI feature] tool"
   Examples: "AI that can transcribe meetings", "AI meeting assistant", "Real-time transcription AI"

3. **Use case specific** (15%): "[Tool type] for [specific role/industry]", "[Feature] software for [scenario]"
   Examples: "Meeting assistant for remote teams", "Note taking app for sales calls", "Transcription tool for interviews"

4. **Comparison/Alternative** (5%): "Alternative to [popular competitor]", "[Tool type] comparison"
   Examples: "Alternative to Otter.ai", "Meeting assistant tools comparison"

CRITICAL RULES:
- Generate exactly 10 queries
- These are PRODUCT SEARCH queries, not problem statements
- Focus on tool types, capabilities, and use cases
- Use keywords: "best", "top", "AI", "[tool type]", "for [use case]"
- NO brand names (except in "alternative to X")
- Queries should be 3-8 words
- Think: "What would I ask ChatGPT to recommend a tool like this?"
- Return ONLY a JSON array of strings

✅ GOOD EXAMPLES:
- "Best AI note taker for meetings"
- "AI that can transcribe video calls"
- "Top meeting assistant tools"
- "Real-time transcription software"
- "AI meeting recorder for teams"
- "Best tool for meeting summaries"
- "AI assistant for online meetings"
- "Automated meeting notes app"

❌ BAD EXAMPLES (too problem-focused):
- "How to take better meeting notes"
- "Struggling to remember action items"
- "Need help with note taking"

❌ BAD (brand-specific):
- "How to use Otter.ai"
- "Fireflies.ai features"`,
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
