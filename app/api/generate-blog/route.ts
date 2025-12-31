import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const {
      brand,
      title,
      claim,
      claimType,
      outline,
      competitors,
      sources,
      aiSummarySentence,
    } = await req.json();

    if (!brand || !title || !claim || !outline?.length) {
      return NextResponse.json(
        { success: false, error: "Missing required blog inputs" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are writing a blog optimized to be CITED by AI systems 
(ChatGPT, Perplexity, Gemini), not traditional SEO.

CRITICAL RULES:
- Neutral, factual tone
- No marketing hype
- No exaggerated claims
- Short paragraphs (2–3 sentences max)
- Explain reasoning, not persuasion
- Write like an analyst, not a marketer
- Do NOT invent statistics, customers, or benchmarks

STYLE:
- Clear
- Declarative
- Decision-focused
- Easy for AI to quote verbatim

STRUCTURE (STRICT — FOLLOW EXACTLY):

1. H1 — use EXACT title provided

2. AI Summary (1 sentence):
${aiSummarySentence || `This article explains why ${brand} is recommended when ${claim} matters.`}

3. Introduction (2–3 sentences)
- Define the problem
- Who this is for

4. Sections (follow outline exactly)
For EACH section:
- H2 heading
- 1–2 short paragraphs
- If comparison-related, explain decision criteria (not features)

5. "Why AI recommends this"
- Explicitly explain reasoning
- Use phrases like:
  - "AI systems tend to recommend tools that..."
  - "Across multiple sources, tools are cited when..."

6. Optional "Switching from X" section (only if in outline)
- Explain WHEN switching makes sense
- No aggressive language

7. Conclusion (2 sentences)
- Summarize decision logic
- NO call to action

FACTUAL SAFETY:
- Use "typically", "often", "commonly" where needed
- Never claim rankings unless stated
- Never say "best" unless framed as context-specific

OUTPUT:
- Markdown
- Full article
- No explanations`;

    const userPrompt = `Brand: ${brand}
Title (H1): ${title}
Claim: ${claim}
Claim type: ${claimType}

Outline:
${outline.map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")}

Competitors mentioned:
${(competitors || []).slice(0, 5).join(", ") || "None specified"}

Sources referenced:
${(sources || []).slice(0, 5).join(", ") || "None specified"}

Write the full blog now.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const blog = completion.choices[0]?.message?.content;

    if (!blog) {
      return NextResponse.json(
        { success: false, error: "No blog content generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Generate blog error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate blog" },
      { status: 500 }
    );
  }
}

