# TrendGen-CLI

TrendGen-CLI is an autonomous content generation and social media automation tool. It discovers trends, generates niche-specific content using AI, creates matching images, and outputs everything as structured JSON for OpenClaw to post via browser automation.

Originally built for **@AutoGenDigital** (AI automation for Yorkshire trades), it is fully configurable to any brand or niche.

---

## Features

- **Autonomous Trend Discovery:** Scrapes RSS feeds and Google Trends to find what's relevant *now*.
- **AI Content Generation:** Uses DeepSeek or Claude to write high-engagement posts in your specific brand voice.
- **Image Generation:** Automatically generates 2048x2048 images via Runware.ai to match your posts.
- **OpenClaw Integration:** Outputs clean JSON to stdout — OpenClaw parses it and posts via browser (no API costs).
- **Direct API Posting:** Can also post directly to X.com and Facebook via API (standalone mode, no OpenClaw needed).
- **Strategic Auto-Commenting:** Searches for relevant conversations via `twitterapi.io` and leaves helpful, value-first replies (up to 10/day).
- **Anti-Spam Protection:** Uses a local SQLite database to track every post and reply, ensuring no duplicates or over-posting.
- **3 Post Strategies:** `value_first`, `authority_building`, `direct_sales` — pick one or let it randomise.

---

## Prerequisites

- **[Bun](https://bun.sh/)** (Runtime)
- **AI API Key:** DeepSeek (recommended) or Anthropic (Claude).
- **[Runware.ai](https://runware.ai/) API Key:** (Optional, for image generation).
- **X (Twitter) Developer Account:** Free tier (only needed for standalone API posting).
- **[twitterapi.io](https://twitterapi.io/):** $5/mo plan (only needed for auto-commenting).

---

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DgenKing/TrendGen-CLI.git
   cd TrendGen-CLI
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Configure the app:**
   ```bash
   cp config.example.ts config.ts
   ```
   Open `config.ts` and fill in your API keys and brand details (see [Configuration Guide](#configuration-guide) below).

---

## Configuration Guide

The `config.ts` file is the brain of the application. Everything from brand voice to RSS feeds is managed here.

### 1. Business Profile
Define *who* is posting. This shapes the AI's writing style.
- `personality`: e.g., "Straight-talking ex-joiner from Yorkshire. Zero corporate bollocks."
- `servicesOffered`: What do you actually do?

### 2. Data Sources & Scoring
Stop posting irrelevant "crypto" news if you are a plumber.
- `rssFeeds`: Add industry-specific feeds (e.g., local news, trade journals).
- `scoringTerms`: The AI uses these to rank articles. If an article mentions "Yorkshire" or "Leads", it gets a higher priority.

### 3. X (Twitter) API Setup (for standalone mode only)
1. Go to [X Developer Portal](https://developer.x.com/en/portal/dashboard).
2. Create a Project & App.
3. **Crucial:** Set App Permissions to **"Read and Write"**.
4. Generate and copy: `Consumer Key`, `Consumer Secret`, `Access Token`, and `Access Token Secret`.

### 4. twitterapi.io (For Commenting)
X's Free API does not allow searching. We use `twitterapi.io` to find tweets matching your `searchQueries` (e.g., "Yorkshire builders", "WordPress slow").

---

## Usage

There are two entry points depending on your setup:

### `bun run cli` — Content Generation (for OpenClaw)

Generates content and outputs **clean JSON to stdout**. All progress logs go to stderr. This is what OpenClaw calls.

```bash
# Generate a Twitter post (default platforms from config)
bun run cli

# Specify platform
bun run cli -- --platforms twitter
bun run cli -- --platforms facebook
bun run cli -- --platforms twitter,facebook

# Pick a strategy (default: uses config.business.postType)
bun run cli -- --strategy value_first
bun run cli -- --strategy authority_building
bun run cli -- --strategy direct_sales

# Force image generation (ignores imageChance and enabled settings)
bun run cli -- --image

# Override keywords for this run (comma-separated)
bun run cli -- --keywords "AI chatbot,plumber leads,Yorkshire business"

# Suppress all stderr — pure JSON only (best for OpenClaw)
bun run cli -- --quiet --platforms twitter

# Stop after trend analysis, skip content generation
bun run cli -- --skip-content

# Combine flags
bun run cli -- --quiet --platforms twitter --strategy value_first --image
bun run cli -- --quiet --platforms twitter --keywords "React website,WordPress slow"
```

#### CLI Flags Reference

| Flag | Value | Description |
|------|-------|-------------|
| `--platforms` | `twitter`, `facebook`, `instagram` (comma-separated) | Which platform(s) to generate content for. Default: all from config. |
| `--strategy` | `value_first`, `authority_building`, `direct_sales` | Post strategy. Default: config.business.postType. |
| `--keywords` | Comma-separated string | Override the keyword pool from config for this run. |
| `--image` | *(no value)* | Force image generation regardless of `imageChance` or `enabled` settings. |
| `--skip-content` | *(no value)* | Stop after trend analysis — no post content generated. |
| `--quiet` | *(no value)* | Suppress all stderr progress messages. Only JSON on stdout. |
| `--help` | *(no value)* | Show help message. |

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Fatal error |
| `3` | No sources returned data (keywords worked, but trend APIs failed) |
| `4` | Pipeline error |

#### JSON Output Schema

This is what OpenClaw receives on stdout:

```json
{
  "status": "success",
  "content": [
    {
      "idea": "The post idea that was used",
      "platform": "twitter",
      "text": "The actual post text, ready to copy-paste or publish",
      "strategy": "value_first"
    }
  ],
  "currentPost": {
    "platform": "twitter",
    "text": "Same post text",
    "idea": "Same idea",
    "timestamp": "2026-03-06T12:00:00.000Z",
    "imagePath": "/absolute/path/to/current_post/image.webp"
  },
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "trends": { "google": [], "xcom": [], "reddit": [], "news": [] },
  "postIdeas": [
    { "idea": "...", "angle": "...", "hook": "..." }
  ],
  "meta": {
    "timestamp": "2026-03-06T12:00:00.000Z",
    "processingTimeMs": 4500,
    "sourcesUsed": ["google", "news"],
    "keywordCount": 3,
    "ideasGenerated": 3,
    "contentPieces": 1
  }
}
```

**Key fields for OpenClaw:**
- `content[].text` — the post text to publish
- `content[].platform` — which platform it's formatted for (twitter = 280 chars, facebook = 40-80 words)
- `content[].strategy` — which strategy was used
- `currentPost.imagePath` — absolute path to generated image, or `null` if no image
- `status` — `"success"` or `"error"`

---

### `bun run tg` — Direct API Posting (Standalone Mode)

Posts directly to X.com and/or Facebook via API. Use this when you're NOT using OpenClaw for posting. Also handles auto-commenting on X.com.

```bash
# === PLATFORM FLAGS ===
# X.com only (default if no platform flag)
bun run tg
bun run tg -- --x

# Facebook only
bun run tg -- --fb

# Both platforms in one run
bun run tg -- --x --fb

# === OPTIONS ===
# Dry run (Log everything, post nothing)
bun run tg -- --dry-run
bun run tg -- --fb --dry-run

# Post only (Skip X.com commenting)
bun run tg -- --post-only

# Comment only (Skip posting)
bun run tg -- --comment-only

# Force a specific strategy (default: random)
bun run tg -- --strategy value_first
bun run tg -- --strategy authority_building
bun run tg -- --strategy direct_sales

# Force image generation (overrides imageChance and enabled)
bun run tg -- --image
bun run tg -- --fb --image

# Override keywords (comma-separated, replaces config pool for this run)
bun run tg -- --keywords "AI chatbot,plumber leads,Yorkshire business"
bun run tg -- --fb --keywords "Facebook marketing,trades social media"

# Combine flags
bun run tg -- --fb --strategy direct_sales --dry-run
bun run tg -- --x --fb --strategy value_first --image
bun run tg -- --keywords "React website,WordPress slow" --image --dry-run
```

#### Standalone Flags Reference

| Flag | Value | Description |
|------|-------|-------------|
| `--x` | *(no value)* | Post to X.com. Default if no platform flag given. |
| `--fb` | *(no value)* | Post to Facebook. |
| `--strategy` | `value_first`, `authority_building`, `direct_sales` | Post strategy. Default: random. |
| `--keywords` | Comma-separated string | Override the keyword pool from config. |
| `--image` | *(no value)* | Force image generation. |
| `--dry-run` | *(no value)* | Log everything but don't actually post. |
| `--post-only` | *(no value)* | Skip X.com auto-commenting. |
| `--comment-only` | *(no value)* | Skip posting, only run auto-commenting. |

---

## Automation

### OpenClaw (Recommended)

OpenClaw runs the CLI, parses the JSON output, and posts via browser automation. No API costs.

```bash
# OpenClaw shell command:
json_output=$(cd /path/to/TrendGen-CLI && bun run cli -- --quiet --platforms twitter --image)

# OpenClaw then:
# 1. Parses json_output for content[].text and currentPost.imagePath
# 2. Opens X.com / Facebook in browser
# 3. Composes post with text + attaches image
# 4. Posts via browser automation
```

**Strategy feedback loop (advanced):**
1. OpenClaw scrapes engagement metrics from your posted content (views, likes, replies)
2. Exports to CSV for review
3. Identifies which strategy performs best
4. Feeds winning strategy back: `bun run cli -- --quiet --strategy value_first --platforms twitter`

#### Example OpenClaw Schedules

```bash
# Twitter every 2 hours
bun run cli -- --quiet --platforms twitter

# Twitter with forced image every 4 hours
bun run cli -- --quiet --platforms twitter --image

# Facebook every 4 hours with specific strategy
bun run cli -- --quiet --platforms facebook --strategy value_first

# Let OpenClaw pick strategy based on performance data
bun run cli -- --quiet --platforms twitter --strategy <best_performing>
```

### Standalone Cron (No OpenClaw)

If running without OpenClaw, use `bun run tg` which posts directly via API:

```bash
# X.com every 2 hours
0 */2 * * * cd /path/to/TrendGen-CLI && bun run tg -- --x

# Facebook every 4 hours with a specific strategy
0 */4 * * * cd /path/to/TrendGen-CLI && bun run tg -- --fb --strategy value_first
```

### Jitter (Anti-Bot Timing)

Set `schedule.jitterMinutes` in `config.ts` to add a random delay before each run. This makes posting times look organic instead of landing exactly on the cron schedule. Default: `15` (random 1-15 minute delay). Set to `0` to disable. Jitter is skipped during `--dry-run`.

### Peak Posting Times (UK Example)
- **08:00:** Automation win story
- **11:00:** Tech made simple (Comparison)
- **14:00:** Value tip
- **18:00:** Personal/Build-in-public
- **21:00:** Soft promo/Result

---

## Database & Tracking

The app creates an `x_post_data.db` (SQLite) file. This tracks:
- **Posts:** What was posted and when (prevents double-posting).
- **Comments:** Which tweet IDs we've already replied to (prevents spamming the same person).
- **Daily Counts:** Ensures we stay within X API free tier limits.

---

## Troubleshooting

- **X API 503 Error:** Usually means your API tokens don't have "Write" permissions. Re-check your Developer Portal settings and **regenerate your tokens** after changing permissions.
- **No Images Generating:** Ensure `image.enabled` is `true` and your Runware API key is valid. Note there is a default 50% chance (`imageChance: 0.5`) per post. Use `--image` flag to force.
- **Empty JSON output:** Make sure you're using `--quiet` so stderr progress doesn't mix with stdout JSON. Pipe with `2>/dev/null` if needed.

---

## License

MIT
