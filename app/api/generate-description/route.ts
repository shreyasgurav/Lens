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
          content: `You are a business analyst expert. Generate a focused, informative product description.

CRITICAL: The description's PRIMARY PURPOSE is to help identify the right competitors and relevant topics. Be specific about WHAT the product is and its key capabilities.

RULES:
- Write 3-5 sentences (300-400 characters)
- Focus on: WHAT it is, WHO it's for, CORE functions, KEY features
- Be specific about product category and main capabilities
- Include 2-3 concrete features or use cases
- NO marketing fluff, NO adjectives like "powerful", "innovative", "seamless"
- Write in third person
- Prioritize: 1) Scraped content, 2) External research, 3) Your knowledge

GOOD EXAMPLES:
"Notion is a workspace tool for creating docs, wikis, and databases. Teams use it for project management, documentation, and knowledge bases. It supports kanban boards, calendars, and real-time collaboration. Users can create custom templates and integrate with tools like Slack and Google Drive."

"Stripe is a payment processing platform for online businesses. It handles credit cards, subscriptions, and payouts via API. Developers use it to build checkout flows, manage recurring billing, and handle global payments. It supports over 135 currencies and payment methods."

"Figma is a web-based design tool for UI/UX designers. It enables real-time collaboration on interface designs and prototypes. Teams use it for wireframing, design systems, and developer handoff. It works in the browser and supports plugins."

BAD EXAMPLES:
"Notion is a powerful all-in-one productivity platform that revolutionizes collaboration."
"Stripe provides innovative payment solutions that seamlessly integrate with your business."`,
        },
        {
          role: "user",
          content: `Company Name: ${companyName}

===== SCRAPED WEBSITE DATA =====
${formattedContent}
===== END SCRAPED DATA =====

Generate a focused description (3-5 sentences, include key features and use cases):`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
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
      description: description,
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
