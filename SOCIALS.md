# SOCIALS.md — Facebook + Instagram Auto-Posting Plan

## What Already Works

The content pipeline **already generates platform-specific content** for all 3 platforms:

| Platform | Format | Chars | Hashtags | Style |
|----------|--------|-------|----------|-------|
| Twitter | Punchy single statement | 280 max | 2-4 | Direct, no-BS |
| Instagram | Multi-paragraph with emojis | 2,200 max | 5-10 at end | Visual, storytelling |
| Facebook | Conversational, question-focused | 40-80 words | 2+ | Community, engagement |

- `lib/content.ts` → `getPlatformSpecs()` handles all formatting
- `lib/pipeline.ts` → generates separate content per platform from the same post idea
- `cli.ts` → `--platforms instagram,facebook` already produces correctly formatted text
- Image generation → 1024×1024 square (works for Instagram)

**Only X.com has actual posting integration.** Facebook and Instagram need API integration built.

---

## What's Missing (Per Platform)

| Component | Facebook | Instagram |
|-----------|----------|-----------|
| Config block in `config.ts` | Need `facebook:{}` | Need `instagram:{}` |
| Poster module | `lib/fb-poster.ts` | `lib/instagram-poster.ts` |
| Entry point | `fb-integration.ts` | `instagram-integration.ts` |
| API dependency | Meta Graph API (no npm package needed — use `fetch`) | Meta Graph API (same) |
| package.json script | `"fb": "bun --use-system-ca fb-integration.ts"` | `"insta": "bun --use-system-ca instagram-integration.ts"` |
| DB tracking | Add `fb_posts` to daily_counts | Add `insta_posts` to daily_counts |

---

## Facebook Integration

### Meta Graph API — How It Works

Post to a Facebook Page (not personal profile — Meta doesn't allow bot posting to personal profiles):

```
POST https://graph.facebook.com/v19.0/{page-id}/feed
Content-Type: application/json

{
  "message": "Your post text here",
  "access_token": "PAGE_ACCESS_TOKEN"
}
```

With image:
```
POST https://graph.facebook.com/v19.0/{page-id}/photos
Content-Type: multipart/form-data

photo: <image file>
message: "Your post text here"
access_token: PAGE_ACCESS_TOKEN
```

### Config Block — Add to `config.ts`

```ts
// === FACEBOOK AUTO-POSTING ===
// Posts to a Facebook Page via Meta Graph API.
//
// Setup:
//   1. Create a Facebook Page for your business (if not already)
//   2. Go to https://developers.facebook.com → Create App → Business type
//   3. Add "Facebook Login for Business" product
//   4. Go to Graph API Explorer: https://developers.facebook.com/tools/explorer/
//   5. Select your app → Get User Token → check pages_manage_posts, pages_read_engagement
//   6. Click "Get Access Token" → authorize
//   7. Exchange for a long-lived Page Access Token:
//      GET /me/accounts?access_token=USER_TOKEN → find your page → copy access_token
//   8. That page access token never expires — paste below
//
facebook: {
  enabled: false,                          // flip to true once set up
  pageId: "",                              // Facebook Page ID (numeric)
  pageAccessToken: "",                     // Long-lived Page Access Token
  postsPerDay: 3,                          // hard cap
  dryRun: false,                           // true = log but don't post
},
```

### `lib/fb-poster.ts` — ~80 lines

Follow the same pattern as `lib/x-poster.ts`:

```ts
import { config } from "../config";
import { logPost, incrementPostCount } from "./x-db"; // reuse DB
import fs from "fs";

export async function postToFacebook(text: string, imagePath?: string | null): Promise<PostResult> {
  if (config.facebook.dryRun) {
    console.log(`[DRY RUN] Would post to Facebook: ${text.substring(0, 100)}...`);
    return { success: true, dryRun: true };
  }

  const baseUrl = `https://graph.facebook.com/v19.0/${config.facebook.pageId}`;

  // If image — use /photos endpoint with multipart
  // If text only — use /feed endpoint with JSON
  // Log to DB
  // Return { success, postId }
}
```

### `fb-integration.ts` — Entry Point

```
bun run fb                    # Full run: generate + post
bun run fb -- --dry-run       # Log everything, post nothing
```

Flow:
1. Check `config.facebook.enabled`
2. Check daily cap from DB
3. Run pipeline with `platforms: ["facebook"]`
4. Read `current_post/post.json` (will contain facebook-formatted content)
5. Post via `lib/fb-poster.ts`
6. Log to DB

**Note:** The pipeline currently saves the **twitter** post to `current_post/post.json`. This needs a small change — the integration entry point should either:
- (a) Pass the platform to `saveCurrentPost` so it saves the right format, OR
- (b) Access the pipeline result directly (the `content` array has all platforms)

Option (b) is cleaner — `fb-integration.ts` calls `runPipeline({ platforms: ["facebook"] })` and the first result in the content array will be the facebook-formatted post.

---

## Instagram Integration

### Meta Graph API — How It Works

Instagram posting uses the **Instagram Graph API** (not the basic display API). Requires a Facebook Page linked to an Instagram Business/Creator account.

**Two-step process** (Instagram requires this):

Step 1 — Create media container:
```
POST https://graph.facebook.com/v19.0/{ig-user-id}/media
{
  "caption": "Your caption with #hashtags",
  "image_url": "https://publicly-accessible-url.com/image.jpg",
  "access_token": "PAGE_ACCESS_TOKEN"
}
→ Returns: { "id": "container_id" }
```

Step 2 — Publish:
```
POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish
{
  "creation_id": "container_id",
  "access_token": "PAGE_ACCESS_TOKEN"
}
→ Returns: { "id": "published_post_id" }
```

**Important:** Instagram requires either:
- `image_url` — a publicly accessible URL to the image (not a local file)
- OR upload via Facebook Page first and reference the media

Since we generate images locally (`current_post/image.webp`), we'd need to either:
1. Upload to a public URL first (e.g., Imgur, S3, or Facebook itself)
2. Or use the Facebook Page Photos API to upload, then reference in Instagram

**Simplest approach:** Upload image to Facebook Page (unlisted/unpublished), get the URL, use that for Instagram. Or use a free image host like Imgur's API.

### Config Block — Add to `config.ts`

```ts
// === INSTAGRAM AUTO-POSTING ===
// Posts to Instagram via Meta Graph API.
// Requires: Facebook Page linked to Instagram Business/Creator account.
//
// Setup:
//   1. Convert Instagram to Business or Creator account
//   2. Link to your Facebook Page (Instagram Settings → Linked Accounts)
//   3. Use same Facebook Developer App as above
//   4. In Graph API Explorer, also check instagram_basic, instagram_content_publish
//   5. Get your Instagram User ID:
//      GET /me/accounts?access_token=TOKEN → find page →
//      GET /{page-id}?fields=instagram_business_account → get ig user ID
//   6. Paste below
//
instagram: {
  enabled: false,                          // flip to true once set up
  igUserId: "",                            // Instagram Business Account ID
  pageAccessToken: "",                     // Same Page Access Token as Facebook
  postsPerDay: 2,                          // hard cap (Instagram penalises overposting)
  dryRun: false,
  imageRequired: true,                     // Instagram needs images — skip post if no image generated
},
```

### `lib/instagram-poster.ts` — ~100 lines

```ts
export async function postToInstagram(text: string, imagePath?: string | null): Promise<PostResult> {
  if (!imagePath && config.instagram.imageRequired) {
    console.log("[SKIP] No image generated — Instagram requires an image");
    return { success: false, error: "No image" };
  }

  // Step 1: Upload image to get public URL (use Facebook page photos API or Imgur)
  // Step 2: Create media container with caption
  // Step 3: Publish container
  // Log to DB
}
```

### `instagram-integration.ts` — Entry Point

```
bun run insta                 # Full run: generate + post (with image)
bun run insta -- --dry-run    # Log everything, post nothing
```

Flow:
1. Check `config.instagram.enabled`
2. Check daily cap
3. Run pipeline with `platforms: ["instagram"]` — **force image generation** (set imageChance to 1.0 for this run)
4. If no image was generated, skip
5. Upload image → create container → publish
6. Log to DB

---

## Database Changes (`lib/x-db.ts`)

Extend the existing `daily_counts` table (or add new columns):

```sql
-- Current:
date TEXT PRIMARY KEY,
posts_count INTEGER,       -- X.com posts
comments_count INTEGER     -- X.com comments

-- Add:
fb_posts_count INTEGER DEFAULT 0,
insta_posts_count INTEGER DEFAULT 0
```

Add helper functions:
- `getTodayFbPostCount()` / `incrementFbPostCount()`
- `getTodayInstaPostCount()` / `incrementInstaPostCount()`

Reuse existing `logPost()` by adding a `platform` field to the `posts` table:
```sql
ALTER TABLE posts ADD COLUMN platform TEXT DEFAULT 'twitter';
```

---

## Package.json Scripts

```json
"scripts": {
  "cli": "bun --use-system-ca cli.ts",
  "x": "bun --use-system-ca x-integration.ts",
  "fb": "bun --use-system-ca fb-integration.ts",
  "insta": "bun --use-system-ca instagram-integration.ts"
}
```

OpenClaw commands:
```
bun run x          # X.com post + comment
bun run fb         # Facebook post
bun run insta      # Instagram post (with image)
```

---

## Pipeline Change Needed

Currently `x-integration.ts` hardcodes `platforms: ["twitter"]` and `saveCurrentPost` always saves the twitter version. Each integration entry point should:

1. Call `runPipeline({ platforms: ["<platform>"] })` with its own platform
2. Access the content directly from the pipeline result (not from `current_post/post.json`)
3. Or modify `saveCurrentPost` to accept a platform parameter

**Recommended:** Return the content array from `runPipeline()` so each entry point can grab its platform's content directly. The `current_post/post.json` save can stay as a side effect for logging.

---

## Meta Developer Portal Setup — Step by Step

1. Go to https://developers.facebook.com
2. Click "My Apps" → "Create App"
3. Select "Business" type
4. Name it "TrendGen" or "AutoGen Digital"
5. Add products:
   - **Facebook Login for Business** (for page posting)
   - **Instagram Graph API** (for Instagram posting)
6. Go to **Graph API Explorer** (https://developers.facebook.com/tools/explorer/)
7. Select your app
8. Generate User Token with permissions:
   - `pages_manage_posts` — post to Facebook Page
   - `pages_read_engagement` — read engagement metrics
   - `instagram_basic` — Instagram account info
   - `instagram_content_publish` — post to Instagram
9. Click "Get Access Token" → authorize in popup
10. Exchange short-lived token for long-lived:
    ```
    GET https://graph.facebook.com/v19.0/oauth/access_token
      ?grant_type=fb_exchange_token
      &client_id=APP_ID
      &client_secret=APP_SECRET
      &fb_exchange_token=SHORT_LIVED_TOKEN
    ```
11. Get Page Access Token (never expires):
    ```
    GET https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_TOKEN
    ```
    → Copy the `access_token` for your page
12. Get Instagram User ID:
    ```
    GET https://graph.facebook.com/v19.0/{page-id}?fields=instagram_business_account&access_token=PAGE_TOKEN
    ```
13. Paste `pageId`, `pageAccessToken`, `igUserId` into `config.ts`

---

## Free Tier / Costs

| Platform | API Cost | Limits |
|----------|----------|--------|
| Facebook Graph API | Free | 200 posts/hour per page (we do 3/day) |
| Instagram Graph API | Free | 25 posts/24h per account (we do 2/day) |
| Meta Developer App | Free | No monthly fee |

No additional costs beyond what you already pay for X.com and twitterapi.io.

---

## Implementation Order

1. **Facebook first** (simpler — no image upload requirement)
   - Add `facebook:{}` to config.ts + config.example.ts
   - Create `lib/fb-poster.ts`
   - Create `fb-integration.ts`
   - Add DB columns
   - Add `"fb"` script to package.json
   - Test with `bun run fb -- --dry-run`

2. **Instagram second** (needs image upload solution)
   - Add `instagram:{}` to config.ts + config.example.ts
   - Create `lib/instagram-poster.ts` (with image upload)
   - Create `instagram-integration.ts`
   - Add DB columns
   - Add `"insta"` script to package.json
   - Test with `bun run insta -- --dry-run`

3. **Pipeline tweak** — make `runPipeline()` return content array so each entry point can grab its platform's content directly

---

## OpenClaw Schedule (All Platforms)

```
Every 2h → bun run x           # X.com: 5 posts + 10 comments/day
Every 4h → bun run fb          # Facebook: 3 posts/day
Every 6h → bun run insta       # Instagram: 2 posts/day (with image)
```

All self-regulating via daily caps in the DB.
