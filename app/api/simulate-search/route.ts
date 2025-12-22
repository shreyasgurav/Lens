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

    // Generate 3 query variations for this topic
    for (let i = 0; i < 3; i++) {
      // Use the topic directly as the query
      const query = topic;

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

      // Extract brand mentions from the response
      const mentionedBrands = [];
      let position = 1;

      for (const brand of allBrands) {
        // Case-insensitive search for brand mention
        const regex = new RegExp(`\\b${escapeRegex(brand)}\\b`, "gi");
        if (regex.test(response)) {
          mentionedBrands.push({
            name: brand,
            position,
            sentiment: "neutral",
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

      results.push({
        query,
        response,
        mentionedBrands,
        yourBrandMentioned,
        yourBrandPosition,
      });
    }

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
