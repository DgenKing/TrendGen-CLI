// TrendGen CLI - Configuration File
// @DgenKing63330 — Hot Crypto News + Tips + AItech (Degen mode)

export const config = {
  // === BUSINESS PROFILE ===
  business: {
    name: "DgenKing",
    type: "Crypto Influencer",
    city: "Global",
    industry: "Finance, AI Tech",
    targetAudience: "Crypto degens, futures traders, retail investors, memecoin hunters, and AI/Web3 enthusiasts aged 18-45 looking for alpha",
    servicesOffered: "Breaking crypto news, actionable trading tips & futures strategies, AI model news (Claude, OpenAI, Gemini), AI-tech breakdowns, market alpha calls, volatility plays, and degen opportunities",
    personality: "High-energy degen, witty no-BS straight talk, alpha-leaking, meme-savvy, bullish when it counts, community-first",
    postType: "value_first" as const,  // options: "value_first" | "authority_building" | "direct_sales"
    //   value_first        — Helpful/educational content, no selling (builds trust & engagement)
    //   authority_building — Showcase expertise, subtly position your services as solutions
    //   direct_sales       — Clear CTA-driven posts to drive immediate action/conversions
  },

   // === AI PROVIDER ===
  ai: {
    provider: "deepseek" as const,
    apiKey: "sk-0000000000000000000000000",  // Replace with your actual key
    model: "deepseek-chat",
    maxTokens: 4096,
  },


  // === DATA SOURCES ===
  sources: {
    googleTrends: true,
    xcom: false,                          // disabled — not crypto-relevant
    coingecko: true,                      // NEW — trending coins
    reddit: {
      enabled: false,
      clientId: "",
      clientSecret: "",
    },
    news: {
      enabled: true,
      newsApiKey: "",
    },
  },

  // === OUTPUT ===
  output: {
    platforms: ["twitter", "instagram", "facebook"] as const,
    keywords: [
      // --- CRYPTO (50%) --- 
      "bitcoin price prediction", "ethereum news", "crypto futures trading", "altcoin season", "memecoin news", "Hyperliquid trading", "crypto market crash", "BTC volatility", "crypto alpha", "DeFi news UK",
      "bitcoin to zero", "is bitcoin dead", "bitcoin ETF update", "Solana Firedancer upgrade", "SOL price prediction", "SUI token unlock", "AVAX unlock impact", "RWA tokenization news", "stablecoin adoption UK", "ONDO RWA summit",
      "XRP Ripple custody staking", "Ethereum staking rewards 2026", "crypto regulation UK", "White House crypto bill", "SEC pivot crypto cases", "Bitcoin for Corporations Summit", "Consensus Hong Kong highlights", "ETH Denver 2026", "Hyperliquid HYPE unstaking", "perp DEX trading alpha",
      "memecoin launch $PUNCH $PENGU", "TAO AI crypto play", "Solana ecosystem moon", "Layer 2 scaling news", "yield farming UK", "best crypto wallet 2026", "low fee crypto exchange", "hardware wallet review", "crypto taxes UK", "whale alert BTC ETH",
      "crypto bull run 2026", "altcoin rebound", "DeFi lending platform", "tokenized gold news", "prediction market crypto", "ZK privacy coins", "institutional crypto adoption", "MicroStrategy BTC earnings", "Fed crypto injection impact", "crypto options expiry volatility",
      // --- AI TECH (50%) --- 
      "OpenAI latest news", "Claude AI Anthropic", "ChatGPT update", "AI agents news", "Gemini Google AI", "AI crypto projects", "large language models", "AI coding tools", "Sam Altman news", "AI regulation UK",
      "Claude 4.6 Sonnet Opus", "GPT-5.3 Codex release", "Gemini 3 Pro GA", "Grok 4.20 update", "Qwen 3 Coder", "DeepSeek V4", "multimodal AI news", "Lyria 3 audio model", "Kling 3.0 video gen", "Sora 2 photoreal video",
      "agentic AI autonomous agents", "AI coding assistant 2026", "one person empire AI", "China LLM price war", "EU xAI investigation", "OpenAI India 100M users", "AI infrastructure data centers", "quantum AI breakthrough", "enterprise AI factories",
      "AI agent workflows", "reasoning models 2026", "AI ethics regulation UK", "Sam Altman OpenAI drama", "Anthropic Claude agentic coding", "Google DeepMind Lyria", "Meta Avocado model", "AI search visibility", "generative engine optimization GEO",
      "AI crypto intersection TAO", "AI agents trading bots", "multimodal AI agents", "AI regulation EU UK", "Grok xAI news", "Perplexity AI update", "AI hardware efficiency", "agentic commerce AI", "solo founder AI employees", "AI model avalanche 2026",
    ] as string[],
    keywordsPerRun: 3,                     // how many keywords to use per run
    maxKeywords: 6,
    maxPostIdeas: 3,
    maxContentPerIdea: 1,
    logToFile: true,
  },

  // === SCHEDULE ===
  // OpenClaw calls this CLI on a fixed interval (e.g. every 1 hour).
  // The random delay is handled HERE in code — OpenClaw does NOT need to generate any numbers.
  //
  // How it works:
  //   - OpenClaw triggers the CLI every `intervalHours` hours
  //   - When the CLI starts, it picks a random number between 1–(intervalHours×60)-1 minutes
  //   - It waits that long before actually running the pipeline
  //   - This makes posts appear at natural, unpredictable times rather than always on the hour
  //
  // Example (intervalHours: 1):  triggers at 9:00 → waits 23 mins → runs at 9:23
  // Example (intervalHours: 4):  triggers at 9:00 → waits 147 mins → runs at 11:27
  //
  // To run manually without delay: set enabled: false
  schedule: {
    enabled: true,
    intervalHours: 0.05,          // match this to how often OpenClaw calls the CLI
    randomDelayMinutes: false,  // random delay range = 1 to (intervalHours×60 - 1) minutes
  },
};

export type Config = typeof config;
export type Business = typeof config.business;
export type AIConfig = typeof config.ai;
export type SourcesConfig = typeof config.sources;
export type OutputConfig = typeof config.output;
