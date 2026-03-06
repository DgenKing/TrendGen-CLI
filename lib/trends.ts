import { makeRequest } from "./claude";
import { googleTrendsService } from "./sources/google";
import { xcomScraperService } from "./sources/xcom";
import { redditAnalysisService } from "./sources/reddit";
import { newsAnalysisService } from "./sources/news";
import { config } from "../config";

export interface TrendData {
  google: string[];
  xcom: string[];
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
  const [googleSuggestions, xcomTrends, redditDiscussions, newsArticles] = await Promise.allSettled([
    config.sources.googleTrends
      ? googleTrendsService.getAutocompleteSuggestions(keywords, businessData.ukCity)
      : Promise.resolve([]),
    config.sources.xcom
      ? xcomScraperService.getUKTrends()
      : Promise.resolve([]),
    redditAnalysisService.getRelevantDiscussions(keywords, businessData.ukCity),
    newsAnalysisService.getRelevantArticles(keywords, businessData.businessType, businessData.ukCity)
  ]);

  // Extract results and handle failures gracefully
  const trendsData: TrendData = {
    google: googleSuggestions.status === 'fulfilled' ? googleSuggestions.value : [],
    xcom: xcomTrends.status === 'fulfilled' ? xcomTrends.value : [],
    reddit: redditDiscussions.status === 'fulfilled' ? redditDiscussions.value : [],
    news: newsArticles.status === 'fulfilled' ? newsArticles.value : []
  };

  // Log the search results
  if (logger) {
    logger.logGoogleSearch(keywords, trendsData.google);
    logger.logXcomTrends(trendsData.xcom);
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

  return `Analyze these trending topics and generate post ideas for ${businessData.businessName} (${businessData.businessType}). React to the news — be direct, punchy, and relevant to the target audience.${recentPostsWarning}

Business Profile:
- Name: ${businessData.businessName}
- Type: ${businessData.businessType}
- Industry: ${businessData.industry}
- Audience: ${businessData.targetAudience}
- Services: ${businessData.servicesOffered}
${personalityContext}
Content Strategy: ${postTypeGuidelines.strategy}

Latest Trends & News:
${formatTrendsWithContext(trendsData)}

QUALITY GUIDELINES:
- PRIORITIZE breaking news and timely takes — recency matters
- Each idea must feel like something the target audience cares about RIGHT NOW
- Be specific and opinionated — generic "here's what you need to know" is not enough
- Ideas must tie back to what ${businessData.businessName} does and who they serve

VARIETY RULE (CRITICAL):
- MAX 2 ideas can use the "[Big company/product] does X, mine does Y" comparison format
- At least 2 ideas must be audience pain points, tips, or lessons learned (no comparison to other products)
- At least 1 idea should use local/community trends or social trends
- Mix these angles: personal story, customer win, industry hot take, practical tip, myth-busting, behind-the-scenes

Generate 6-8 post concepts that:
1. React directly to a specific trend or news item relevant to the audience
2. Deliver genuine value, a strong take, or real insight
3. Are 4-6 words each (brief and punchy)
4. Appeal directly to: ${businessData.targetAudience}
5. ${postTypeGuidelines.requirements}
${businessData.businessPersonality ? '6. Fully embody the brand personality — no corporate speak, no watered-down takes' : ''}

Tone: ${postTypeGuidelines.tone}
${postTypeGuidelines.examples}

For each idea, specify:
- The exact trend or news source that inspired it
- A relevance score (0.1 to 1.0) — score 0.7+ for timely, high-signal ideas
- Brief note on why this resonates with the target audience

Format as JSON array:
[
  {
    "concept": "Brief post concept",
    "trend_source": "Source: specific trend that inspired this",
    "relevance_score": 0.8,
    "business_benefit": "Why this resonates with the target audience"
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
  // Get fallback ideas from config or use defaults
  const fallbackConcepts = config.prompts?.fallbackIdeas || [
    "AI is changing how trades get leads",
    "WordPress sites are losing you customers",
    "Why your competitors are posting and you're not",
    "React sites load 10x faster than WordPress",
    "One plumber got 18 leads in 30 days with AI",
  ];

  const fallbackIdeas = fallbackConcepts.map((concept, index) => ({
    id: `idea_${index + 1}`,
    concept,
    trend_source: "General: Business & tech trends",
    relevance_score: index < 2 ? 0.7 : 0.6
  }));

  // Upgrade fallback sources with real data if available
  // Upgrade with real trend data if available
  if (trendsData.news.length > 0 && fallbackIdeas.length > 0) {
    fallbackIdeas[0].trend_source = `News: ${trendsData.news[0].headline?.substring(0, 60)}...`;
  }

  if (trendsData.google.length > 0 && fallbackIdeas.length > 1) {
    fallbackIdeas[1].trend_source = `Google Trends: ${trendsData.google[0]}`;
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
      strategy: "Value-First (Engagement) - Educate and help without selling",
      requirements: "Deliver genuine insight, analysis, or news reaction — no self-promotion",
      tone: "High-energy, punchy, no-BS — like sharing insider knowledge with your community",
      examples: "Example concepts: 'Breaking down what just happened', 'Here's what this means for you', 'Quick analysis thread'"
    },
    authority_building: {
      strategy: "Authority Building - Position as the go-to expert in your niche",
      requirements: "Share expert analysis or insider experience that shows real authority",
      tone: "Confident, credible, experienced — you've been there and done it",
      examples: "Example concepts: 'Why I changed my approach', 'What I've learned after years in this game', 'Industry insiders know this'"
    },
    direct_sales: {
      strategy: "Direct Engagement - Drive follows, shares, and community interaction",
      requirements: "Create urgency and FOMO that makes the audience act — comment, share, follow",
      tone: "Hype-driven, direct, action-oriented — make them feel they are missing out if they scroll past",
      examples: "Example concepts: 'Follow for daily insights', 'Drop your take below', 'RT if you agree'"
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

  return formatted || "No trends available";
}
