import { TwitterApi } from "twitter-api-v2";
import { config } from "../config";
import { logPost, incrementPostCount } from "./x-db";
import fs from "fs";
import path from "path";

let client: TwitterApi | null = null;

export function getClient(): TwitterApi {
  if (!client) {
    if (!config.x.consumerKey || !config.x.consumerSecret || !config.x.accessToken || !config.x.accessTokenSecret) {
      throw new Error("Missing X API credentials in config.ts");
    }
    client = new TwitterApi({
      appKey: config.x.consumerKey,
      appSecret: config.x.consumerSecret,
      accessToken: config.x.accessToken,
      accessSecret: config.x.accessTokenSecret,
    });
  }
  return client;
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  dryRun?: boolean;
}

export async function postTweet(text: string, imagePath?: string | null): Promise<PostResult> {
  const isDryRun = config.x.dryRun;

  if (isDryRun) {
    console.log(`[DRY RUN] Would post tweet: ${text.substring(0, 100)}...`);
    if (imagePath) {
      console.log(`[DRY RUN] Would attach image: ${imagePath}`);
    }
    logPost({
      tweet_id: "dry_run_" + Date.now(),
      text,
      image_path: imagePath ?? null,
      posted_at: new Date().toISOString(),
      status: "dry_run",
    });
    return { success: true, dryRun: true };
  }

  // Retry logic for transient errors
  const maxRetries = 3;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const twitter = getClient();
      let mediaId: string | undefined;

      // Upload image if exists
      if (imagePath && fs.existsSync(imagePath)) {
        console.log(`Uploading image: ${imagePath}`);
        const mediaIdResult = await twitter.v1.uploadMedia(imagePath);
        mediaId = mediaIdResult;
      }

      // Post tweet
      const tweet = await twitter.v2.tweet(text, {
        media: mediaId ? { media_ids: [mediaId] } : undefined,
      });

    console.log(`Tweet posted successfully: ${tweet.data.id}`);

    logPost({
      tweet_id: tweet.data.id,
      text,
      image_path: imagePath ?? null,
      posted_at: new Date().toISOString(),
      status: "success",
    });

    incrementPostCount();

    return { success: true, tweetId: tweet.data.id };
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      const isRetryable = error.code === 503 || errorMessage.includes("503");

      // If retryable and we have attempts left, wait and retry
      if (isRetryable && attempt < maxRetries) {
        console.log(`[RETRY] 503 error, attempt ${attempt}/${maxRetries}, waiting ${retryDelay}ms...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }

      // Final attempt failed
      console.error(`Failed to post tweet: ${errorMessage}`);

      logPost({
        tweet_id: "failed_" + Date.now(),
        text,
        image_path: imagePath ?? null,
        posted_at: new Date().toISOString(),
        status: "failed",
      });

      // Handle rate limiting
      if (error.code === 429 || errorMessage.includes("Too Many Requests")) {
        return { success: false, error: "Rate limited", tweetId: undefined };
      }

      // Handle auth errors
      if (error.code === 401 || error.code === 403 || errorMessage.includes("Unauthorized")) {
        return { success: false, error: "Auth error - check config.ts keys", tweetId: undefined };
      }

      // Handle 503 - suggest upgrade
      if (error.code === 503) {
        return { success: false, error: "503 Service Unavailable - X API free tier is unreliable. Consider upgrading to Basic ($100/mo)", tweetId: undefined };
      }

      return { success: false, error: errorMessage, tweetId: undefined };
    }
  }

  // Should never reach here
  return { success: false, error: "Max retries exceeded", tweetId: undefined };
}

export function resetClient(): void {
  client = null;
}
