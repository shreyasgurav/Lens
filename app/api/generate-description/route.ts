import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { scrapeWebsite, formatScrapedDataForLLM } from "@/lib/scraper";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { url, companyName } = await request.json();

    if (!url || !companyName) {
      return NextResponse.json(
        { success: false, error: "Missing url or companyName" },
        { status: 400 }
      );
    }

    console.log(`Scraping website: ${url}`);
    
    // Step 1: Comprehensively scrape the website (multiple pages)
    const scrapedData = await scrapeWebsite(url);
    console.log(`Scraped ${scrapedData.productFeatures.length} features, ${scrapedData.pricing.length} pricing items`);
    
    // Step 2: Use AI to search web for additional context about the brand
    let externalInfo = "";
    try {
      const searchCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a research assistant. Given a company name and website, provide a brief summary of what you know about this company from your training data. Include:
- What the company does
- Their main products/services
- Target audience
- Key differentiators
Keep it factual and concise (max 300 words). If you don't have information, say so.`,
          },
          {
            role: "user",
            content: `Company: ${companyName}\nWebsite: ${url}\n\nWhat do you know about this company?`,
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      });
      
      externalInfo = searchCompletion.choices[0]?.message?.content?.trim() || "";
      console.log(`AI research completed: ${externalInfo.length} chars`);
    } catch (error) {
      console.error("AI research failed:", error);
    }
    
    // Step 3: Format all data for description generation
    const formattedContent = formatScrapedDataForLLM(scrapedData, externalInfo);

    // Generate description using OpenAI with rich context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a business analyst expert at understanding what companies do.

Your task is to generate a clear, factual business description using ALL available information: scraped website data, external research, and your knowledge.

CRITICAL RULES:
- Maximum 500 characters
- Prioritize information in this order: 1) Scraped website content, 2) External research, 3) Your knowledge
- Focus on: What the product/service IS, WHO it's for, HOW it works
- Include specific capabilities when available
- Write in third person ("Company X is..." or "Product X provides...")
- Be specific about features, use cases, or target audience
- If website content is minimal, use external research and your knowledge to fill gaps
- DO NOT include pricing, contact info, or calls to action
- Avoid vague phrases like "comprehensive solution" - be concrete

IMPORTANT: Even if website content is limited, generate a useful description based on what you know about the company from external sources or your training data. Don't say "cannot formulate description" unless you truly have zero information.

Good example: "Notion is a workspace tool that combines notes, docs, wikis, and project management. Users can create databases, kanban boards, and collaborative documents. It integrates with Slack, Google Drive, and Figma, and is used by teams for documentation and task tracking."

Bad example: "Notion is a powerful all-in-one productivity platform that helps teams work better together with innovative features."`,
        },
        {
          role: "user",
          content: `Company Name: ${companyName}

===== SCRAPED WEBSITE DATA =====
${formattedContent}
===== END SCRAPED DATA =====

Based on this ACTUAL website content, generate a precise business description (max 500 chars):`,
        },
      ],
      max_tokens: 250,
      temperature: 0.5, // Lower temperature for more factual output
    });

    const description = completion.choices[0]?.message?.content?.trim() || "";

    // Also extract category for later use
    const categoryCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Based on the business description, output a single primary product category. Be specific.
Examples: "Browser Automation Tool", "Email Marketing Platform", "Project Management Software", "AI Writing Assistant", "CRM Software", "Video Conferencing Tool"
Output ONLY the category, nothing else.`,
        },
        {
          role: "user",
          content: description,
        },
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    const category = categoryCompletion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      success: true,
      description: description.slice(0, 500),
      category,
      scrapedFeatures: scrapedData.productFeatures.slice(0, 10),
      scrapedKeywords: scrapedData.keywords.slice(0, 10),
    });
  } catch (error) {
    console.error("Error generating description:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate description" },
      { status: 500 }
    );
  }
}
