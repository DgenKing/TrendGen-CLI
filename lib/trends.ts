import { makeRequest } from "./claude";
import { googleTrendsService } from "./sources/google";
import { xcomScraperService } from "./sources/xcom";
import { coinGeckoService } from "./sources/coingecko";
import { redditAnalysisService } from "./sources/reddit";
import { newsAnalysisService } from "./sources/news";
import { config } from "../config";

export interface TrendData {
  google: string[];
  xcom: string[];
  coingecko: any[];
  reddit: any[];
  news: any[];
}

export async function analyzeTrends(
  keywords: string[],
  businessData: {
    businessType: string;
    ukCity: string;
    industry: string;
    postType?: string;
  },
  logger?: any
): Promise<TrendData> {
  // Run all trend analysis in parallel for better performance
  const [googleSuggestions, xcomTrends, coingeckoTrends, redditDiscussions, newsArticles] = await Promise.allSettled([
    config.sources.googleTrends
      ? googleTrendsService.getAutocompleteSuggestions(keywords, businessData.ukCity)
      : Promise.resolve([]),
    config.sources.xcom
      ? xcomScraperService.getUKTrends()
      : Promise.resolve([]),
    config.sources.coingecko
      ? coinGeckoService.getTrendingCoins()
      : Promise.resolve([]),
    redditAnalysisService.getRelevantDiscussions(keywords, businessData.ukCity),
    newsAnalysisService.getRelevantArticles(keywords, businessData.businessType, businessData.ukCity)
  ]);

  // Extract results and handle failures gracefully
  const trendsData: TrendData = {
    google: googleSuggestions.status === 'fulfilled' ? googleSuggestions.value : [],
    xcom: xcomTrends.status === 'fulfilled' ? xcomTrends.value : [],
    coingecko: coingeckoTrends.status === 'fulfilled' ? coingeckoTrends.value : [],
    reddit: redditDiscussions.status === 'fulfilled' ? redditDiscussions.value : [],
    news: newsArticles.status === 'fulfilled' ? newsArticles.value : []
  };

  // Log the search results
  if (logger) {
    logger.logGoogleSearch(keywords, trendsData.google);
    logger.logXcomTrends(trendsData.xcom);
    logger.logCoingeckoTrends(trendsData.coingecko);
    logger.logRedditSearch(keywords, trendsData.reddit);
    logger.logCryptoNews(trendsData.news);
  }

  return trendsData;
}

export interface PostIdea {
  id: string;
  concept: string;
  trend_source: string;
  relevance_score: number;
  business_benefit?: string;
}

export async function generatePostIdeas(
  businessData: {
    businessName: string;
    businessType: string;
    ukCity: string;
    industry: string;
    targetAudience: string;
    servicesOffered: string;
    businessPersonality?: string;
    postType?: string;
  },
  trendsData: TrendData,
  logger?: any
): Promise<PostIdea[]> {
  const prompt = buildPostIdeaPrompt(businessData, trendsData);
  const content = await makeRequest(prompt, 1500);
  const postIdeas = parsePostIdeasFromResponse(content, trendsData);

  if (logger) {
    logger.logContentGeneration(postIdeas, prompt);
  }

  return postIdeas;
}

function buildPostIdeaPrompt(businessData: any, trendsData: TrendData): string {
  const personalityContext = businessData.businessPersonality
    ? `- Business Personality & Values: ${businessData.businessPersonality}\n`
    : '';

  const postTypeGuidelines = getPostTypeGuidelines(businessData.postType || 'value_first');

  return `Analyze these carefully filtered trending topics and generate social media post ideas for a UK business. Focus on GENUINE connections that provide real business value.

Business Details:
- Name: ${businessData.businessName}
- Type: ${businessData.businessType}
- Location: ${businessData.ukCity}
- Industry: ${businessData.industry}
- Target Audience: ${businessData.targetAudience}
- Services: ${businessData.servicesOffered}
${personalityContext}
Content Strategy: ${postTypeGuidelines.strategy}

High-Relevance Trends:
${formatTrendsWithContext(trendsData)}

IMPORTANT QUALITY GUIDELINES:
- REJECT forced connections - trends must naturally relate to the business
- PRIORITIZE evergreen topics over fleeting viral content
- FOCUS on trends that solve customer problems or demonstrate expertise
- Each trend connection must provide clear business benefit or audience value
- Avoid superficial hashtag jumping - connections must feel authentic

Generate 6-8 post concepts that:
1. Connect trends AUTHENTICALLY to this business (no forced connections)
2. Provide genuine value or solve real problems for the target audience
3. Are 4-6 words each (brief and punchy)
4. Focus on UK market and local relevance
5. ${postTypeGuidelines.requirements}
${businessData.businessPersonality ? '6. Align with the business personality, values, and unique positioning' : ''}
7. Demonstrate clear business benefit from the trend connection

Tone: ${postTypeGuidelines.tone}
${postTypeGuidelines.examples}

For each idea, specify:
- The exact trend source that inspired it
- A relevance score (0.1 to 1.0) - ONLY score 0.7+ if connection is genuinely valuable
- Brief business benefit explanation

Format as JSON array:
[
  {
    "concept": "Brief post concept",
    "trend_source": "Source: specific trend that inspired this",
    "relevance_score": 0.8,
    "business_benefit": "Clear benefit this provides to business/audience"
  }
]

Return ONLY the JSON array, no other text:`;
}

function parsePostIdeasFromResponse(content: string, trendsData: TrendData): PostIdea[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return getFallbackPostIdeas(trendsData);
    }

    const ideas = JSON.parse(jsonMatch[0]);

    return ideas.map((idea: any, index: number) => ({
      id: `idea_${index + 1}`,
      concept: idea.concept || `Business idea ${index + 1}`,
      trend_source: idea.trend_source || "General trend analysis",
      relevance_score: idea.relevance_score || 0.5,
      business_benefit: idea.business_benefit || "Provides engagement opportunity"
    }))
      .sort((a: PostIdea, b: PostIdea) => b.relevance_score - a.relevance_score)
      .slice(0, 8);
  } catch (error) {
    console.error("Error parsing post ideas:", error);
    return getFallbackPostIdeas(trendsData);
  }
}

function getFallbackPostIdeas(trendsData: TrendData): PostIdea[] {
  const fallbackIdeas = [
    {
      id: "idea_1",
      concept: "Local community support",
      trend_source: "General: Community engagement trends",
      relevance_score: 0.7
    },
    {
      id: "idea_2",
      concept: "Customer appreciation post",
      trend_source: "Social media: Customer loyalty trends",
      relevance_score: 0.6
    },
    {
      id: "idea_3",
      concept: "Behind the scenes content",
      trend_source: "Content: Transparency trends",
      relevance_score: 0.8
    },
    {
      id: "idea_4",
      concept: "Local partnerships showcase",
      trend_source: "Business: Collaboration trends",
      relevance_score: 0.7
    },
    {
      id: "idea_5",
      concept: "Seasonal service highlight",
      trend_source: "Seasonal: Current trends",
      relevance_score: 0.6
    }
  ];

  // Try to connect to actual trends if available
  if (trendsData.reddit.length > 0) {
    fallbackIdeas[0].trend_source = `Reddit: ${trendsData.reddit[0].title?.substring(0, 50)}...`;
  }

  if (trendsData.news.length > 0) {
    fallbackIdeas[1].trend_source = `BBC: ${trendsData.news[0].headline?.substring(0, 50)}...`;
  }

  return fallbackIdeas;
}

function getPostTypeGuidelines(postType: string): {
  strategy: string;
  requirements: string;
  tone: string;
  examples: string;
} {
  const guidelines = {
    value_first: {
      strategy: "Value-First (Engagement) - Build trust and provide genuine value without selling",
      requirements: "Focus on helping, educating, or entertaining the audience without any promotional content",
      tone: "Helpful, educational, approachable - no selling language",
      examples: "Example concepts: 'Five-minute home fixes', 'Local weather prep tips', 'Yorkshire community news'"
    },
    authority_building: {
      strategy: "Authority Building (Promotional) - Showcase expertise while subtly highlighting services",
      requirements: "Demonstrate competence and unique approach while gently positioning services as solutions",
      tone: "Confident, expert, credible - subtle promotion through demonstrated expertise",
      examples: "Example concepts: 'Why professionals choose...', 'Behind our process', 'Client success stories'"
    },
    direct_sales: {
      strategy: "Direct Sales (Advertising) - Clear calls-to-action to drive immediate business results",
      requirements: "Include clear calls-to-action and conversion-focused language that drives immediate action",
      tone: "Direct, compelling, action-oriented - clear value proposition and next steps",
      examples: "Example concepts: 'Book your appointment', 'Limited time offer', 'Call now for...'"
    }
  };

  return guidelines[postType as keyof typeof guidelines] || guidelines.value_first;
}

function formatTrendsWithContext(trendsData: TrendData): string {
  let formatted = '';

  if (trendsData.google.length > 0) {
    formatted += `Google Search Trends:\n${trendsData.google.join(', ')}\n\n`;
  }

  if (trendsData.reddit.length > 0) {
    formatted += `Relevant Business Discussions:\n${trendsData.reddit.map((d: any) => `"${d.title}" (${d.comments} comments, ${d.score} score)`).join('; ')}\n\n`;
  }

  if (trendsData.news.length > 0) {
    formatted += `Industry News:\n${trendsData.news.map((a: any) => a.headline || a.description).join('; ')}\n\n`;
  }

  if (trendsData.xcom.length > 0) {
    formatted += `Social Trends:\n${trendsData.xcom.join(', ')}\n\n`;
  }

  if (trendsData.coingecko.length > 0) {
    formatted += `Trending Coins:\n${trendsData.coingecko.map((c: any) => `${c.name} (${c.symbol}) - Rank #${c.rank}`).join(', ')}\n\n`;
  }

  return formatted || "No trends available";
}
