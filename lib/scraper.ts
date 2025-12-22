/**
 * Advanced website scraper that extracts structured data from multiple pages
 * to understand what a company actually does.
 */

interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  content: string;
  links: string[];
}

interface ScrapedData {
  homepage: ScrapedPage | null;
  aboutPage: ScrapedPage | null;
  featuresPage: ScrapedPage | null;
  pricingPage: ScrapedPage | null;
  productPage: ScrapedPage | null;
  allContent: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  productFeatures: string[];
  pricing: string[];
  socialProof: string[];
}

// Pages to try scraping (relative paths)
const PAGES_TO_SCRAPE = [
  "", // homepage
  "about",
  "about-us",
  "features",
  "product",
  "products",
  "pricing",
  "solutions",
  "platform",
  "how-it-works",
  "services",
  "what-we-do",
  "use-cases",
  "customers",
  "case-studies",
  "blog",
  "resources",
];

/**
 * Scrapes a single page and extracts structured data
 */
async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    const description = descMatch ? descMatch[1].trim() : "";

    // Extract all headings (h1, h2, h3)
    const headingMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
    const headings: string[] = [];
    for (const match of headingMatches) {
      const heading = match[1].replace(/\s+/g, " ").trim();
      if (heading.length > 3 && heading.length < 200) {
        headings.push(heading);
      }
    }

    // Extract internal links for further crawling
    const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);
    const links: string[] = [];
    for (const match of linkMatches) {
      const href = match[1];
      if (
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !href.includes("#")
      ) {
        links.push(href);
      }
    }

    // Extract main content - remove scripts, styles, nav, footer
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit content length
    content = content.slice(0, 8000);

    return { url, title, description, headings, content, links };
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return null;
  }
}

/**
 * Extract product features from content
 */
function extractFeatures(content: string, headings: string[]): string[] {
  const features: string[] = [];

  // Look for feature-like patterns
  const featurePatterns = [
    /(?:features?|capabilities|what (?:we|you) (?:do|get)|benefits)[\s\S]{0,500}?([^.]+\.)/gi,
    /(?:✓|✔|•|→|►)\s*([^.\n]+)/gi,
  ];

  for (const pattern of featurePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const feature = match[1]?.trim();
      if (feature && feature.length > 10 && feature.length < 150) {
        features.push(feature);
      }
    }
  }

  // Add relevant headings as features
  for (const heading of headings) {
    if (
      heading.toLowerCase().includes("feature") ||
      heading.toLowerCase().includes("benefit") ||
      heading.toLowerCase().includes("why") ||
      heading.toLowerCase().includes("how")
    ) {
      features.push(heading);
    }
  }

  return [...new Set(features)].slice(0, 15);
}

/**
 * Extract pricing information
 */
function extractPricing(content: string): string[] {
  const pricing: string[] = [];
  const pricePatterns = [
    /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo(?:nth)?|yr|year|user|seat))?/gi,
    /(?:free|starter|pro|enterprise|business|team)[\s]*(?:plan|tier)?/gi,
    /(?:pricing|plans?)[\s\S]{0,200}?(\$[\d,]+)/gi,
  ];

  for (const pattern of pricePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      pricing.push(match[0].trim());
    }
  }

  return [...new Set(pricing)].slice(0, 10);
}

/**
 * Extract social proof (testimonials, customer names, stats)
 */
function extractSocialProof(content: string): string[] {
  const proof: string[] = [];

  // Look for customer counts, testimonials, etc.
  const patterns = [
    /(\d+(?:,\d+)?(?:\+)?)\s*(?:customers?|users?|companies|teams|businesses)/gi,
    /(?:trusted by|used by|loved by|powering)\s+([^.]+)/gi,
    /(?:Fortune|Inc\.|Forbes)\s*\d*/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      proof.push(match[0].trim());
    }
  }

  return [...new Set(proof)].slice(0, 10);
}

/**
 * Extract keywords from meta tags and content
 */
function extractKeywords(html: string, content: string): string[] {
  const keywords: string[] = [];

  // Meta keywords
  const keywordsMatch = html.match(
    /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i
  );
  if (keywordsMatch) {
    keywords.push(...keywordsMatch[1].split(",").map((k) => k.trim()));
  }

  // OG tags
  const ogMatches = html.matchAll(
    /<meta[^>]*property=["']og:(?:title|description)["'][^>]*content=["']([^"']+)["']/gi
  );
  for (const match of ogMatches) {
    const words = match[1].split(/\s+/).filter((w) => w.length > 4);
    keywords.push(...words);
  }

  return [...new Set(keywords)].slice(0, 20);
}

/**
 * Main function to scrape a website comprehensively
 */
export async function scrapeWebsite(baseUrl: string): Promise<ScrapedData> {
  // Normalize base URL
  let normalizedUrl = baseUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }
  // Remove trailing slash
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

  const result: ScrapedData = {
    homepage: null,
    aboutPage: null,
    featuresPage: null,
    pricingPage: null,
    productPage: null,
    allContent: "",
    metaTitle: "",
    metaDescription: "",
    keywords: [],
    productFeatures: [],
    pricing: [],
    socialProof: [],
  };

  // Scrape pages in parallel (with limit)
  const pagesToScrape = PAGES_TO_SCRAPE.map((path) =>
    path ? `${normalizedUrl}/${path}` : normalizedUrl
  );

  const scrapedPages = await Promise.all(
    pagesToScrape.map((url) => scrapePage(url))
  );

  // Categorize scraped pages
  for (let i = 0; i < scrapedPages.length; i++) {
    const page = scrapedPages[i];
    if (!page) continue;

    const path = PAGES_TO_SCRAPE[i];

    if (!path) {
      result.homepage = page;
      result.metaTitle = page.title;
      result.metaDescription = page.description;
    } else if (path.includes("about")) {
      result.aboutPage = page;
    } else if (path.includes("feature") || path.includes("platform")) {
      result.featuresPage = page;
    } else if (path.includes("pricing")) {
      result.pricingPage = page;
    } else if (path.includes("product") || path.includes("solution")) {
      result.productPage = page;
    }
  }

  // Combine all content
  const allPages = scrapedPages.filter(Boolean) as ScrapedPage[];
  const allContent = allPages.map((p) => p.content).join("\n\n");
  const allHeadings = allPages.flatMap((p) => p.headings);

  result.allContent = allContent.slice(0, 20000);
  result.productFeatures = extractFeatures(allContent, allHeadings);
  result.pricing = extractPricing(allContent);
  result.socialProof = extractSocialProof(allContent);

  if (result.homepage) {
    // Get raw HTML for keyword extraction
    try {
      const response = await fetch(normalizedUrl);
      const html = await response.text();
      result.keywords = extractKeywords(html, allContent);
    } catch {
      // Ignore
    }
  }

  return result;
}

/**
 * Search the web for information about a company/brand
 */
export async function searchWebForBrand(companyName: string, websiteUrl: string): Promise<string> {
  try {
    // Extract domain for search
    const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    // Search query to find info about the company
    const searchQuery = `${companyName} ${domain} what does company do product service`;
    
    // Use a simple web search approach - in production, you'd use Perplexity API or similar
    // For now, we'll try to get more context from the domain itself
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    // Note: In production, you should use:
    // - Perplexity API (pplx-api)
    // - Serper API
    // - Brave Search API
    // - Or similar search APIs that allow programmatic access
    
    // For now, return a placeholder that indicates we attempted search
    return `Search attempted for: "${searchQuery}"\nNote: Implement proper search API (Perplexity/Serper) for production use.`;
  } catch (error) {
    console.error('Web search failed:', error);
    return '';
  }
}

/**
 * Format scraped data for LLM consumption
 */
export function formatScrapedDataForLLM(data: ScrapedData, externalInfo?: string): string {
  const sections: string[] = [];

  if (data.metaTitle) {
    sections.push(`Website Title: ${data.metaTitle}`);
  }

  if (data.metaDescription) {
    sections.push(`Website Description: ${data.metaDescription}`);
  }

  if (data.homepage?.headings.length) {
    sections.push(
      `Main Headlines:\n${data.homepage.headings.slice(0, 15).join("\n")}`
    );
  }

  if (data.productFeatures.length) {
    sections.push(`Product Features:\n${data.productFeatures.join("\n")}`);
  }

  if (data.aboutPage?.content) {
    sections.push(
      `About Page Content:\n${data.aboutPage.content.slice(0, 3000)}`
    );
  }

  if (data.featuresPage?.content) {
    sections.push(
      `Features Page Content:\n${data.featuresPage.content.slice(0, 2500)}`
    );
  }

  if (data.productPage?.content) {
    sections.push(
      `Product Page Content:\n${data.productPage.content.slice(0, 2000)}`
    );
  }

  if (data.pricing.length) {
    sections.push(`Pricing Info: ${data.pricing.join(", ")}`);
  }

  if (data.socialProof.length) {
    sections.push(`Social Proof: ${data.socialProof.join(", ")}`);
  }

  if (data.keywords.length) {
    sections.push(`Keywords: ${data.keywords.join(", ")}`);
  }

  // Add external search info if available
  if (externalInfo) {
    sections.push(`External Information:\n${externalInfo}`);
  }

  // Add general homepage content if we have space
  if (data.homepage?.content && sections.join("\n\n").length < 18000) {
    sections.push(
      `Homepage Content:\n${data.homepage.content.slice(0, 4000)}`
    );
  }

  return sections.join("\n\n---\n\n");
}
