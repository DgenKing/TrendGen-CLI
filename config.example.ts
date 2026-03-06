// TrendGen CLI - Configuration File
// Copy this file to config.ts and fill in your details.
//
// Two example profiles below — uncomment whichever fits:
//   EXAMPLE A: Crypto influencer (@DgenKing style)     ← ACTIVE by default
//   EXAMPLE B: Local business (@AutoGenDigital style)   ← commented out
//
// The pipeline adapts to whatever you put in business{} — crypto, trades, SaaS, whatever.

export const config = {
  // === BUSINESS PROFILE ===
  // This drives ALL content generation — prompts, tone, keywords, everything.

  // --- EXAMPLE A: Crypto Influencer ---
  business: {
    name: "DgenKing",
    type: "Crypto Influencer",
    city: "Global",
    industry: "Crypto, DeFi, AI Tech",
    targetAudience: "Crypto degens, futures traders, retail investors, memecoin hunters, and AI/Web3 enthusiasts aged 18-45 looking for alpha",
    servicesOffered: "Breaking crypto news, actionable trading tips & futures strategies, AI model news (Claude, OpenAI, Gemini), AI-tech breakdowns, market alpha calls, volatility plays, and degen opportunities",
    personality: "High-energy degen, witty no-BS straight talk, alpha-leaking, meme-savvy, bullish when it counts, community-first",
    postType: "value_first" as const,
    //   value_first        — Helpful/educational content, no selling (builds trust & engagement)
    //   authority_building — Showcase expertise, subtly position your services as solutions
    //   direct_sales       — Clear CTA-driven posts to drive immediate action/conversions
  },

  // --- EXAMPLE B: Local Business (uncomment to use) ---
  // business: {
  //   name: "AutoGen Digital",
  //   type: "AI Automation & Web Design Agency",
  //   city: "Pontefract",
  //   industry: "AI Automation, Social Media Automation, Fast React Websites, Digital Marketing",
  //   targetAudience: "Trades businesses in Yorkshire (joiners, plumbers, electricians, builders) who want leads on autopilot",
  //   servicesOffered: "£500 React websites (no WordPress), £99/mo AI-powered social media automation, AI chatbots, lead generation systems",
  //   personality: "Straight-talking ex-joiner from Pontefract. Yorkshire direct, zero corporate bollocks. Confident, helpful, build-in-public energy.",
  //   postType: "authority_building" as const,
  // },

  // === AI PROVIDER ===
  ai: {
    provider: "deepseek" as const,
    apiKey: "",                            // Get from https://platform.deepseek.com
    model: "deepseek-chat",
    maxTokens: 4096,
  },

  // === DATA SOURCES ===
  sources: {
    googleTrends: true,
    xcom: true,
    reddit: {
      enabled: false,
      clientId: "",
      clientSecret: "",
    },
    news: {
      enabled: true,
      newsApiKey: "",
      // RSS feeds for news discovery — add feeds relevant to YOUR niche
      rssFeeds: [
        // --- CRYPTO ---
        "https://cointelegraph.com/rss",
        "https://www.coindesk.com/arc/outboundfeeds/rss/",
        "https://decrypt.co/feed",
        // --- AI / TECH ---
        "https://techcrunch.com/category/artificial-intelligence/feed/",
        "https://venturebeat.com/category/ai/feed/",
        "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        // --- LOCAL BIZ (uncomment if relevant) ---
        // "https://startups.co.uk/feed/",
        // "https://smallbusiness.co.uk/feed/",
      ],
      // Terms for scoring article relevance — higher score = more relevant to you
      scoringTerms: {
        industry: [
          // CRYPTO example:
          "bitcoin", "btc", "ethereum", "eth", "solana", "defi", "memecoin",
          "altcoin", "futures", "trading", "whale", "staking", "layer 2",
          // BIZ example (uncomment):
          // "builder", "plumber", "electrician", "tradesman", "small business",
          // "website", "WordPress", "SEO", "local business", "marketing",
        ],
        tech: [
          "ai", "artificial intelligence", "automation", "chatgpt", "claude",
          "llm", "agent", "openai", "anthropic", "deepseek", "gemini",
        ],
      },
    },
  },

  // === OUTPUT ===
  output: {
    platforms: ["twitter", "instagram", "facebook"] as const,
    keywords: [
      // Add 50-100 keywords relevant to your niche.
      // The pipeline picks a few per run to find trending content.

      // --- CRYPTO EXAMPLE ---
      "bitcoin price prediction", "ethereum news", "crypto futures trading",
      "altcoin season", "memecoin news", "BTC volatility", "crypto alpha",
      "DeFi news", "Solana ecosystem", "Layer 2 scaling news",
      "bitcoin ETF update", "crypto regulation", "whale alert BTC ETH",
      "crypto bull run 2026", "yield farming", "best crypto wallet 2026",
      // --- AI TECH ---
      "OpenAI latest news", "Claude AI Anthropic", "ChatGPT update",
      "AI agents news", "Gemini Google AI", "large language models",
      "AI coding tools", "agentic AI autonomous agents", "AI regulation",
      "reasoning models 2026", "multimodal AI news", "DeepSeek V4",

      // --- BIZ EXAMPLE (uncomment) ---
      // "AI for small business", "automate social media", "website speed SEO",
      // "React vs WordPress speed", "get leads from Twitter", "no time to post",
    ] as string[],
    keywordsPerRun: 3,                     // how many keywords to use per run
    maxKeywords: 6,
    maxPostIdeas: 3,
    maxContentPerIdea: 1,
    logToFile: true,
  },

  // === PROMPT CONFIG ===
  // All prompt-influencing settings — change these to tune content style
  prompts: {
    keywordFocus: [
      // What the keyword generation should focus on
      "Industry trends relevant to the target audience",
      "AI and automation tools the audience cares about",
      "Problems the target audience searches for",
      "Competitor analysis and market positioning",
    ],
    keywordExamples: [
      // Example types of keywords to generate
      "Specific industry terms",
      "AI tool names and model releases",
      "Pain points and trending narratives",
    ],
    fallbackIdeas: [
      // Fallback post ideas when AI generation fails
      // CRYPTO:
      "BTC dominance is shifting — here's what that means",
      "AI models are getting scary good — which one wins 2026?",
      // BIZ:
      // "AI is changing how businesses get leads",
      // "Why your competitors are posting and you're not",
    ],
  },

  // === IMAGE GENERATION ===
  // After content is generated, an image may be created.
  // The image prompt is auto-generated from the post text, then sent to Runware.ai.
  // Output goes to /current_post/ (overwritten each run).
  image: {
    enabled: true,
    runwareApiKey: "",                     // Get from https://runware.ai
    model: "runware:100@1",               // Fast general-purpose model
    width: 1024,
    height: 1024,                         // Square — optimised for X.com / Instagram
    outputFormat: "WEBP" as const,
    imageChance: 0.5,                     // 0.5 = 50% chance of generating an image
    stylePrompt: "Clean, professional design suitable for your brand.",
    brandContext: "Your business description for image context",
  },

  // === SCHEDULE ===
  // OpenClaw calls this CLI on a fixed interval (e.g. every 2-4 hours).
  // The jitter adds a random delay so posts don't land exactly on the hour.
  //
  // Example: OpenClaw triggers at 9:00 → jitter adds 7 mins → runs at 9:07
  //
  // To run manually without delay: set enabled: false
  schedule: {
    enabled: false,                        // set true if using built-in scheduler
    intervalHours: 4,                      // match this to how often OpenClaw calls the CLI
    randomDelayMinutes: false,             // legacy — use jitterMinutes instead
    jitterMinutes: 15,                     // random delay 1-15 mins for organic posting
  },

  // === X.COM AUTO-POSTING ===
  // Posts generated content directly to X.com + replies to relevant tweets.
  //
  // Uses X API pay-per-use for posting (~$0.005/tweet)
  // Uses twitterapi.io for searching tweets to comment on ($5/mo)
  //
  // X API Setup:
  //   1. Go to https://developer.x.com/en/portal/dashboard
  //   2. Create Project (Production environment) → Create App
  //   3. App Settings → User authentication → Set permissions to "Read and Write"
  //   4. Keys and Tokens tab:
  //      - Consumer Keys → Regenerate → copy API Key + API Key Secret
  //      - Authentication Tokens → Generate → copy Access Token + Access Token Secret
  //   5. Paste all 4 values below
  //   6. Buy credits at developer.x.com → Billing ($5 lasts ~66 days at 15 tweets/day)
  //
  // twitterapi.io Setup:
  //   1. Go to https://twitterapi.io → Sign up → Subscribe to $5/mo plan
  //   2. Copy API key → paste below
  x: {
    enabled: false,                        // flip to true once all keys are set
    consumerKey: "",                       // X API — Consumer Key (API Key)
    consumerSecret: "",                    // X API — Consumer Secret (API Key Secret)
    accessToken: "",                       // X API — Access Token
    accessTokenSecret: "",                 // X API — Access Token Secret
    postsPerDay: 5,                        // hard cap — won't exceed this
    commentsPerDay: 10,                    // hard cap on replies per 24h
    dryRun: false,                         // true = log everything but don't actually post
    username: "YourHandle",                // your X handle — skip own tweets when commenting
    minLikesFilter: 1,                     // skip tweets with fewer likes than this
    fallbackReply: "Happy to chat if you need a hand — what's your biggest headache right now?",
  },

  twitterApiIo: {
    enabled: false,                        // set to true to enable tweet search + commenting
    apiKey: "",                            // twitterapi.io key ($5/mo)
    searchQueries: [                       // find tweets to comment on
      // Add queries relevant to YOUR niche:
      // CRYPTO:
      "bitcoin prediction",
      "crypto futures tips",
      "best altcoins 2026",
      "AI crypto projects",
      // BIZ:
      // "need a builder Yorkshire",
      // "plumber website UK",
      // "small business social media UK",
    ],
    searchHashtags: [                      // hashtags to monitor
      // CRYPTO:
      "#Bitcoin",
      "#Crypto",
      "#DeFi",
      "#Altcoins",
      // BIZ:
      // "#SmallBusinessUK",
      // "#BuildersUK",
    ],
  },
};

export type Config = typeof config;
export type Business = typeof config.business;
export type AIConfig = typeof config.ai;
export type SourcesConfig = typeof config.sources;
export type OutputConfig = typeof config.output;
export type XConfig = typeof config.x;
export type TwitterApiIoConfig = typeof config.twitterApiIo;
