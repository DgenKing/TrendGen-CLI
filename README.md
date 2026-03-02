# TrendGen-CLI

TrendGen-CLI is an autonomous content generation and social media automation tool designed to keep your brand active on X.com (Twitter). It discovers trends, generates niche-specific content using AI, creates matching images, and handles both auto-posting and strategic auto-commenting.

Originally built for **@AutoGenDigital** (AI automation for Yorkshire trades), it is fully configurable to any brand or niche.

---

## 🚀 Features

- **Autonomous Trend Discovery:** Scrapes RSS feeds, Google Trends, and CoinGecko to find what's relevant *now*.
- **AI Content Generation:** Uses DeepSeek or Claude to write high-engagement posts in your specific brand voice.
- **Image Generation:** Automatically generates 1024x1024 images via Runware.ai to match your posts.
- **Smart Auto-Posting:** Posts up to 5 times a day during peak engagement windows.
- **Strategic Auto-Commenting:** Searches for relevant conversations via `twitterapi.io` and leaves helpful, value-first replies (up to 10/day).
- **Anti-Spam Protection:** Uses a local SQLite database to track every post and reply, ensuring no duplicates or over-posting.
- **Dry-Run Mode:** Test your prompts and search queries without actually spending API credits or posting publicly.

---

## 🛠 Prerequisites

- **[Bun](https://bun.sh/)** (Runtime)
- **X (Twitter) Developer Account:** Free tier (for posting).
- **[twitterapi.io](https://twitterapi.io/):** $5/mo plan (required for searching tweets to comment on).
- **AI API Key:** DeepSeek (recommended) or Anthropic (Claude).
- **[Runware.ai](https://runware.ai/) API Key:** (Optional, for image generation).

---

## ⚙️ Setup & Installation

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

## 📖 Configuration Guide

The `config.ts` file is the brain of the application. Everything from brand voice to RSS feeds is managed here.

### 1. Business Profile
Define *who* is posting. This shapes the AI's writing style.
- `personality`: e.g., "Straight-talking ex-joiner from Yorkshire. Zero corporate bollocks."
- `servicesOffered`: What do you actually do?

### 2. Data Sources & Scoring
Stop posting irrelevant "crypto" news if you are a plumber.
- `rssFeeds`: Add industry-specific feeds (e.g., local news, trade journals).
- `scoringTerms`: The AI uses these to rank articles. If an article mentions "Yorkshire" or "Leads", it gets a higher priority.

### 3. X (Twitter) API Setup
1. Go to [X Developer Portal](https://developer.x.com/en/portal/dashboard).
2. Create a Project & App.
3. **Crucial:** Set App Permissions to **"Read and Write"**.
4. Generate and copy: `Consumer Key`, `Consumer Secret`, `Access Token`, and `Access Token Secret`.

### 4. twitterapi.io (For Commenting)
X's Free API does not allow searching. We use `twitterapi.io` to find tweets matching your `searchQueries` (e.g., "Yorkshire builders", "WordPress slow").

---

## 🕹 Usage

### The Main Integration (Post + Comment)
This is what you'll run most of the time. It checks your daily caps, generates content if needed, and searches for tweets to reply to.

```bash
# Standard run (Respects config caps)
bun run x

# Dry run (Log everything, post nothing)
bun run x -- --dry-run

# Post only (Skip commenting)
bun run x -- --post-only

# Comment only (Skip posting)
bun run x -- --comment-only

# Posts today: 2/5 (Resets midnight)
bun run x -- --status 


```

### Content Generation Only
If you just want to see what the AI generates without any X integration:
```bash
bun run cli
```

---

## 🕒 Automation (The "Hands-Free" Strategy)

To run this 24/7, we recommend triggering the script every 2 hours. The script handles its own internal caps (e.g., it won't post more than 5 times a day even if triggered 12 times).

### Using OpenClaw
If you are using OpenClaw, use this schedule:
```
Every 2 hours: bun run x
```

### Peak Posting Times (UK Example)
The script is optimized for these windows:
- **08:00:** Automation win story
- **11:00:** Tech made simple (Comparison)
- **14:00:** Value tip
- **18:00:** Personal/Build-in-public
- **21:00:** Soft promo/Result

---

## 🗄 Database & Tracking

The app creates an `x_post_data.db` (SQLite) file. This tracks:
- **Posts:** What was posted and when (prevents double-posting).
- **Comments:** Which tweet IDs we've already replied to (prevents spamming the same person).
- **Daily Counts:** Ensures we stay within X API free tier limits.

---

## ⚠️ Troubleshooting

- **X API 503 Error:** Usually means your API tokens don't have "Write" permissions. Re-check your Developer Portal settings and **regenerate your tokens** after changing permissions.
- **No Images Generating:** Ensure `image.enabled` is `true` and your Runware API key is valid. Note there is a default 50% chance (`imageChance: 0.5`) per post.
- **Crypto Content in a Non-Crypto Niche:** Check `lib/sources/news.ts` or your `config.ts`. Ensure the hardcoded crypto RSS feeds are replaced with your niche feeds.

---

## 📜 License

MIT
