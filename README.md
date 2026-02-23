# TrendGen-CLI

**Crypto & AI Influencer Content Generator**

A TypeScript/Bun CLI tool that generates social media content for crypto/AI influencers. Scrapes trends from multiple sources, uses DeepSeek AI to generate post ideas and content, and can optionally generate images via Runware.ai.

## Features

### Multi-Source Trend Analysis
- **Google Autocomplete** - UK-focused search suggestions
- **CoinGecko** - Trending cryptocurrencies
- **RSS Feeds** - 8 news sources (CoinTelegraph, CoinDesk, Cryptonews, Decrypt, TechCrunch, VentureBeat, The Verge, Ars Technica)
- **Reddit** - UK subreddit discussions (requires API credentials)
- **X.com** - UK trending topics (currently disabled)

### AI Content Generation
- **Provider**: DeepSeek (deepseek-chat)
- **5-Step Pipeline**:
  1. Keyword selection (from 100-keyword pool or AI-generated)
  2. Trend analysis across all sources
  3. Post idea generation with relevance scoring
  4. Platform-specific content (Twitter, Instagram, Facebook)
  5. Optional image generation

### Content Strategies
- **Value First** - Educational/alpha content, no selling
- **Authority Building** - Expert positioning
- **Direct Sales** - CTA-driven engagement

### Image Generation
- **Provider**: Runware.ai
- **Chance**: Configurable (default 80%)
- **Output**: 1024x1024 square WEBP images

### CLI Options
```bash
bun run cli --platforms twitter
bun run cli --platforms twitter,instagram
bun run cli --strategy direct_sales
bun run cli --keywords "bitcoin,ethereum" --platforms twitter
bun run cli --skip-content  # Trend analysis only
bun run cli --quiet         # JSON-only output
bun run cli --help          # Show help
```

## Installation

```bash
git clone git@github.com:DgenKing/TrendGen-CLI.git
cd TrendGen-CLI
bun install
cp config.example.ts config.ts
# Edit config.ts — add your DeepSeek + Runware API keys
```

```bash
# Run (use this — includes --use-system-ca for Linux TLS)
bun run cli

# Direct (may fail with cert errors on Linux)
bun --use-system-ca cli.ts
```

## Configuration

Edit `config.ts` to customize:

- **AI Provider**: DeepSeek API key
- **Image Generation**: Runware.ai API key
- **Keywords**: 100-keyword pool (50 crypto / 50 AI)
- **Schedule**: Random delay settings
- **Sources**: Enable/disable individual sources

### API Keys Required

| Service | Purpose | Config Field |
|---------|---------|--------------|
| DeepSeek | AI content generation | `config.ai.apiKey` |
| Runware.ai | Image generation | `config.image.runwareApiKey` |

### Optional APIs

| Service | Purpose | Config Field |
|---------|---------|--------------|
| Reddit | UK discussions | `config.sources.reddit.clientId`, `clientSecret` |
| NewsAPI | UK news | `config.sources.news.newsApiKey` |

## Project Structure

```
cli.ts              # Entry point, CLI args, scheduling
lib/
  pipeline.ts       # 5-step content generation pipeline
  claude.ts        # DeepSeek API client
  trends.ts        # Post idea generation
  content.ts       # Platform-specific content
  image.ts         # Runware.ai image generation
  keywords.ts       # Keyword selection
  logger.ts        # Process & post logging
  cache.ts         # In-memory TTL cache
  schedule-logger.ts
  sources/
    google.ts      # Google autocomplete
    coingecko.ts   # Trending coins
    news.ts        # RSS feed parser
    xcom.ts        # UK trends (disabled)
    reddit.ts      # Reddit search (disabled)
```

## Output

- **JSON to stdout** - Full pipeline results
- **Logs to stderr** - Progress and errors
- **Files**:
  - `current_post/post.json` - Latest generated post
  - `current_post/image.webp` - Generated image (if any)
  - `logs/schedule_logs/schedule.log` - Schedule timing
  - `logs/post_logs/` - Recent posts for dedup

## Business Profile

Configured for **@DgenKing63330** - Crypto influencer targeting:
- Crypto degens, futures traders, retail investors
- AI/Web3 enthusiasts aged 18-45
- Content: Breaking crypto news, trading tips, AI model news

## OpenClaw Plugin

This can also be installed as an OpenClaw plugin:

```bash
openclaw plugins install claw-pack-trends-gen
```

## License

MIT
