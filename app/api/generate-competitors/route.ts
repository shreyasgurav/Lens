import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { description, companyName, category, scrapedFeatures, topics } = await request.json();

    if (!description || !companyName) {
      return NextResponse.json(
        { success: false, error: "Missing description or companyName" },
        { status: 400 }
      );
    }

    // Build rich context for competitor finding
    const featureContext = scrapedFeatures?.length 
      ? `\nKey Features: ${scrapedFeatures.slice(0, 5).join(", ")}`
      : "";
    const categoryContext = category
      ? `\nProduct Category: ${category}`
      : "";
    const topicsContext = topics?.length
      ? `\nTarget Search Topics: ${topics.slice(0, 5).join(", ")}`
      : "";

    // Generate competitors using OpenAI with better context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a competitive intelligence analyst who deeply understands the software/SaaS market.

Your job is to identify REAL, ACTUAL competitors for the product described. These must be real companies that exist.

COMPETITOR CATEGORIES TO INCLUDE:
1. **Direct Competitors** (3-4): Companies that do almost exactly the same thing
2. **Feature Competitors** (2-3): Companies that compete on specific features
3. **Adjacent Solutions** (2-3): Alternative approaches to solving the same problem
4. **Enterprise/SMB Alternatives** (1-2): Different market segment options

CRITICAL RULES:
- ONLY include REAL companies that actually exist
- Each competitor must have a working website
- Include SPECIFIC, KNOWN players in this space
- DO NOT invent fake companies
- Include a mix of well-known and emerging competitors
- Be SPECIFIC to the exact product type, not general software

For each competitor, you MUST provide:
- name: Official company/product name
- website: Their actual website domain (without https://)
- type: "direct" | "feature" | "adjacent" | "alternative"
- reason: One sentence why they compete (10-20 words)

Return ONLY a valid JSON array, no markdown, no explanation:
[{"name": "...", "website": "...", "type": "...", "reason": "..."}, ...]`,
        },
        {
          role: "user",
          content: `Find competitors for:

Company: ${companyName}
Description: ${description}${categoryContext}${featureContext}${topicsContext}

Identify 10 REAL competitors with their actual websites:`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.5, // Lower temperature for more factual/accurate results
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "[]";
    
    // Parse the JSON array from the response
    let competitors: { name: string; website?: string; type?: string; reason?: string }[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        competitors = parsed.map((c: { name?: string; website?: string; type?: string; reason?: string }) => ({
          name: c.name || "",
          website: c.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "",
          type: c.type || "direct",
          reason: c.reason || "",
        }));
      }
    } catch (e) {
      console.error("Failed to parse competitors:", e);
      competitors = [];
    }

    // Filter out any invalid entries AND the user's own brand
    const companyNameLower = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    competitors = competitors.filter((c) => {
      if (!c.name || c.name.length <= 1 || c.name.length >= 50) return false;
      
      // Exclude if competitor name matches company name (various formats)
      const competitorNameLower = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (competitorNameLower === companyNameLower) return false;
      if (c.name.toLowerCase().includes(companyName.toLowerCase())) return false;
      if (companyName.toLowerCase().includes(c.name.toLowerCase()) && c.name.length > 3) return false;
      
      return true;
    });

    // Verify websites exist (basic check - try to get favicon)
    const verifiedCompetitors = await Promise.all(
      competitors.map(async (comp) => {
        if (!comp.website) return comp;
        
        try {
          // Just check if domain looks valid
          const domain = comp.website.split("/")[0];
          if (domain && domain.includes(".")) {
            return {
              ...comp,
              website: domain,
              favicon: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            };
          }
        } catch {
          // Ignore errors
        }
        return comp;
      })
    );

    return NextResponse.json({
      success: true,
      competitors: verifiedCompetitors.slice(0, 12),
    });
  } catch (error) {
    console.error("Error generating competitors:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate competitors" },
      { status: 500 }
    );
  }
}
