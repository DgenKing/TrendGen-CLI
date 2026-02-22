# Claw Pack: TrendGen

**One-command install**
```bash
openclaw plugins install claw-pack-trends-gen
```

Turn OpenClaw into a business content trend analysis specialist. Analyzes trends across Reddit, Google, X (Twitter), CoinGecko, and News sources with AI-powered content generation for social media strategies.

## Features

- **Multi-source trend analysis** - Scans Reddit, Google Trends, X, CoinGecko, and News for emerging trends
- **Platform-specific strategies** - Adapts content for Twitter, Instagram, Facebook
- **AI content generation** - Uses Claude to generate engaging content based on trends
- **Keyword extraction** - Identifies key topics and themes from trend data
- **Flexible filtering** - Filter by platform, strategy type, or custom keywords

## Configuration

Configure in OpenClaw settings:

```json
{
  "trend-gen": {
    "enabled": true,
    "defaultPlatforms": ["twitter", "reddit", "google"],
    "defaultStrategy": "value_first"
  }
}
```

## Usage

After installation, use the skill in OpenClaw:

```bash
openclaw chat --skill trend-gen
```

Example prompts:
- "Find emerging tech trends for Twitter"
- "What are the hottest cryptocurrency trends?"
- "Generate content ideas for my fitness Instagram"
- "Analyze trending topics in AI and machine learning"

## Strategy Types

- **value_first** - Focus on providing value to audience before selling
- **authority_building** - Establish thought leadership in niche
- **direct_sales** - Direct conversion-focused content

## Requirements

- OpenClaw >= 2026.2.0
- Anthropic API key configured in OpenClaw

## License

MIT
