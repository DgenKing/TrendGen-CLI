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
  logger?: any,
  recentPosts: string[] = []
): Promise<PostIdea[]> {
  const prompt = buildPostIdeaPrompt(businessData, trendsData, recentPosts);
  const content = await makeRequest(prompt, 1500);
  const postIdeas = parsePostIdeasFromResponse(content, trendsData);

  if (logger) {
    logger.logContentGeneration(postIdeas, prompt);
  }

  return postIdeas;
}

function buildPostIdeaPrompt(businessData: any, trendsData: TrendData, recentPosts: string[] = []): string {
  const personalityContext = businessData.businessPersonality
    ? `- Business Personality & Values: ${businessData.businessPersonality}\n`
    : '';

  const postTypeGuidelines = getPostTypeGuidelines(businessData.postType || 'value_first');

  const recentPostsWarning = recentPosts.length > 0
    ? `\nRECENTLY COVERED — do NOT generate ideas about these topics (already posted):\n${recentPosts.map((p, i) => `[${i + 1}] ${p}`).join('\n')}\nChoose DIFFERENT topics and angles.\n`
    : '';

  return `Analyze these trending crypto and AI/tech topics and generate post ideas for a crypto influencer & AI tech commentator. React to the news — be direct, punchy, and relevant to the community.${recentPostsWarning}

Influencer Profile:
- Handle: ${businessData.businessName}
- Type: ${businessData.businessType}
- Industry: ${businessData.industry}
- Audience: ${businessData.targetAudience}
- Content: ${businessData.servicesOffered}
${personalityContext}
Content Strategy: ${postTypeGuidelines.strategy}

Latest Trends & News:
${formatTrendsWithContext(trendsData)}

QUALITY GUIDELINES:
- PRIORITIZE breaking news and timely takes — recency is alpha, evergreen is secondary
- Each idea must feel like something the crypto/AI community is actively talking about RIGHT NOW
- Hot takes, market reactions, alpha calls, and AI model drops score highest
- Be specific and opinionated — generic "here's what you need to know" is not enough
- Aim for roughly 50% crypto ideas, 50% AI/tech ideas across the set

Generate 6-8 post concepts that:
1. React directly to a specific trend, price move, or news item
2. Deliver genuine alpha, a spicy take, or real insight for the audience
3. Are 4-6 words each (brief and punchy)
4. Appeal to a global crypto/Web3/AI community
5. ${postTypeGuidelines.requirements}
${businessData.businessPersonality ? '6. Fully embody the influencer personality — no corporate speak, no watered-down takes' : ''}

Tone: ${postTypeGuidelines.tone}
${postTypeGuidelines.examples}

For each idea, specify:
- The exact trend or news source that inspired it
- A relevance score (0.1 to 1.0) — score 0.7+ for timely, high-signal ideas
- Brief note on why this resonates with the crypto/AI audience

Format as JSON array:
[
  {
    "concept": "Brief post concept",
    "trend_source": "Source: specific trend that inspired this",
    "relevance_score": 0.8,
    "business_benefit": "Why this resonates with the crypto/AI audience"
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
      concept: "BTC dominance shifting again",
      trend_source: "General: Crypto market trends",
      relevance_score: 0.7
    },
    {
      id: "idea_2",
      concept: "New AI model just dropped",
      trend_source: "General: AI model releases",
      relevance_score: 0.7
    },
    {
      id: "idea_3",
      concept: "Altcoin season incoming signals",
      trend_source: "General: Crypto cycle analysis",
      relevance_score: 0.6
    },
    {
      id: "idea_4",
      concept: "AI agents changing everything",
      trend_source: "General: Agentic AI trends",
      relevance_score: 0.6
    },
    {
      id: "idea_5",
      concept: "Whale alert worth watching",
      trend_source: "General: On-chain data",
      relevance_score: 0.5
    }
  ];

  // Upgrade fallback sources with real data if available
  if (trendsData.news.length > 0) {
    fallbackIdeas[0].trend_source = `News: ${trendsData.news[0].headline?.substring(0, 60)}...`;
  }

  if (trendsData.coingecko.length > 0) {
    const top = trendsData.coingecko[0];
    fallbackIdeas[2].trend_source = `CoinGecko: ${top.name} (${top.symbol}) trending`;
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
      strategy: "Value-First (Engagement) - Drop alpha, educate, and entertain without shilling",
      requirements: "Deliver genuine insight, market analysis, or news reaction — no self-promotion",
      tone: "High-energy, punchy, no-BS — like texting alpha to your group chat",
      examples: "Example concepts: 'Why BTC just flipped key level', 'Claude 4 just wrecked GPT', 'Altseason checklist right now'"
    },
    authority_building: {
      strategy: "Authority Building - Position as the go-to source for crypto & AI alpha",
      requirements: "Share expert analysis or insider takes that show you called it before the crowd",
      tone: "Confident, analytical, credible — you saw this coming",
      examples: "Example concepts: 'Called this ETH move weeks ago', 'Here is why AI agents win 2026', 'This chart pattern never lies'"
    },
    direct_sales: {
      strategy: "Direct Engagement - Drive follows, shares, and community interaction",
      requirements: "Create urgency and FOMO that makes the audience act — comment, share, follow for more alpha",
      tone: "Hype-driven, direct, action-oriented — make them feel they are missing out if they scroll past",
      examples: "Example concepts: 'Follow for daily alpha', 'Drop your BTC target below', 'RT if you are long ETH'"
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
