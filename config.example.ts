// TrendGen CLI - Configuration File (EXAMPLE)
// Copy this to config.ts and fill in your actual API keys

export const config = {
  // === BUSINESS PROFILE ===
  business: {
    name: "YourName",
    type: "Crypto Influencer",
    city: "Global",
    industry: "Finance",
    targetAudience: "Your target audience",
    servicesOffered: "Your services",
    personality: "Your personality",
    postType: "value_first" as const,
  },

  // === AI PROVIDER ===
  ai: {
    provider: "deepseek" as const,
    apiKey: "YOUR_DEEPSEEK_API_KEY",  // Replace with your actual key
    model: "deepseek-chat",
    maxTokens: 4096,
  },

  // === DATA SOURCES ===
  sources: {
    googleTrends: true,
    xcom: false,
    coingecko: true,
    reddit: {
      enabled: false,
      clientId: "YOUR_REDDIT_CLIENT_ID",
      clientSecret: "YOUR_REDDIT_CLIENT_SECRET",
    },
    news: {
      enabled: true,
      newsApiKey: "YOUR_NEWS_API_KEY",
    },
  },

  // === OUTPUT ===
  output: {
    platforms: ["twitter", "instagram", "facebook"] as const,
    keywords: ["", ""] as string[],
    keywordsPerRun: 6,
    maxKeywords: 12,
    maxPostIdeas: 3,
    maxContentPerIdea: 1,
    logToFile: true,
  },
};

export type Config = typeof config;
export type Business = typeof config.business;
export type AIConfig = typeof config.ai;
export type SourcesConfig = typeof config.sources;
export type OutputConfig = typeof config.output;
