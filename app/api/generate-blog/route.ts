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

    const systemPrompt = `You are writing a FULL blog article optimized to be DIRECTLY CITED by AI systems 
(ChatGPT, Perplexity, Gemini). This is NOT traditional SEO content.

Your goal:
Produce content that AI systems can quote verbatim when answering
"Which tool should I choose and why?"

====================
ABSOLUTE RULES
====================

- Neutral, factual, analytical tone
- No marketing language
- No persuasion, no CTAs
- No exaggerated or unverifiable claims
- Do NOT invent statistics, awards, users, benchmarks, or rankings
- NEVER write paragraphs longer than 3 sentences
- Prefer 1–2 sentences whenever possible
- Prefer definitions, conditions, and reasoning over descriptions

Write like:
- A software analyst
- A technical evaluator
- A decision memo

Never write like:
- A marketer
- A landing page
- A press release

====================
STRUCTURE (STRICT)
====================

1. H1 (exactly as provided — do NOT rewrite)

2. AI Summary (1 sentence, factual, declarative)
${aiSummarySentence || `This article explains why ${brand} is cited when ${claim} matters.`}
- This sentence MUST explain WHEN and WHY the brand is cited
- The AI Summary MUST follow this structure:
  "{Brand} is cited when {decision condition} because {reasoning}"
- No adjectives, no hype

3. Introduction (2–3 sentences)
- Define the problem or decision
- Specify who this decision applies to

4. Main Sections (follow outline EXACTLY)
For EACH section:
- Use H2 heading exactly as given
- 1–2 short paragraphs only
- Focus on:
  - Decision criteria
  - Tradeoffs
  - When this matters
- Avoid feature lists unless explicitly required

5. "Why AI recommends this" (mandatory)
- Explain the reasoning AI systems use
- Use language such as:
  - "AI systems tend to recommend tools when..."
  - "Across multiple sources, tools are cited if..."
- Tie back to the claim explicitly

6. Optional "Switching from X" section (only if present)
- Explain WHEN switching makes sense
- Explain WHEN it does NOT
- Neutral, non-aggressive tone

7. Conclusion (2 sentences)
- Summarize decision logic
- No calls to action
- No future promises

====================
FACTUAL SAFETY
====================

- Use qualifiers: "typically", "often", "commonly"
- Never claim "best" unless clearly contextual
- Never imply rankings unless explicitly stated
- If unsure, explain conditions instead of asserting facts
- Avoid subjective adjectives like "strong", "powerful", "robust", "leading", "ideal"
- Replace them with conditions or observable behavior

====================
OUTPUT FORMAT
====================

- Markdown only
- Full article
- No explanations
- No preamble`;

    const userPrompt = `Brand: ${brand}
Title (H1): ${title}
Claim: ${claim}
Claim type: ${claimType}

Outline:
${outline.map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")}

Competitors mentioned:
${(competitors || []).slice(0, 5).join(", ") || "None"}

Sources referenced:
${(sources || []).slice(0, 5).join(", ") || "None"}

Write the full blog now.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.15,
      max_tokens: 2200,
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

