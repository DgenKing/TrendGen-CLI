import { config } from "../config";
import { logPost, incrementFbPostCount } from "./x-db";
import fs from "fs";

export interface FbPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  dryRun?: boolean;
}

const GRAPH_API = "https://graph.facebook.com/v19.0";

export async function postToFacebook(text: string, imagePath?: string | null): Promise<FbPostResult> {
  if (config.facebook.dryRun) {
    console.log(`[DRY RUN] Would post to Facebook: ${text.substring(0, 100)}...`);
    if (imagePath) {
      console.log(`[DRY RUN] Would attach image: ${imagePath}`);
    }
    logPost({
      tweet_id: "fb_dry_run_" + Date.now(),
      text,
      image_path: imagePath ?? null,
      posted_at: new Date().toISOString(),
      status: "dry_run",
      platform: "facebook",
    });
    return { success: true, dryRun: true };
  }

  if (!config.facebook.pageId || !config.facebook.pageAccessToken) {
    return { success: false, error: "Missing Facebook pageId or pageAccessToken in config.ts" };
  }

  const maxRetries = 3;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result: any;

      if (imagePath && fs.existsSync(imagePath)) {
        // Post with image — multipart form data to /photos endpoint
        console.log(`Uploading image to Facebook: ${imagePath}`);
        const formData = new FormData();
        const imageBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([imageBuffer]);
        formData.append("source", blob, "image.webp");
        formData.append("message", text);
        formData.append("access_token", config.facebook.pageAccessToken);

        const response = await fetch(`${GRAPH_API}/${config.facebook.pageId}/photos`, {
          method: "POST",
          body: formData,
        });

        result = await response.json();

        if (!response.ok) {
          throw new FbApiError(result.error?.message || `HTTP ${response.status}`, result.error?.code);
        }
      } else {
        // Text-only post to /feed endpoint
        const response = await fetch(`${GRAPH_API}/${config.facebook.pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            access_token: config.facebook.pageAccessToken,
          }),
        });

        result = await response.json();

        if (!response.ok) {
          throw new FbApiError(result.error?.message || `HTTP ${response.status}`, result.error?.code);
        }
      }

      const postId = result.id || result.post_id;
      console.log(`Facebook post published: ${postId}`);

      logPost({
        tweet_id: postId,
        text,
        image_path: imagePath ?? null,
        posted_at: new Date().toISOString(),
        status: "success",
        platform: "facebook",
      });

      incrementFbPostCount();

      return { success: true, postId };
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      const errorCode = error.code;
      const isRetryable = errorCode >= 500 || errorMessage.includes("temporarily unavailable");

      if (isRetryable && attempt < maxRetries) {
        console.log(`[RETRY] Facebook API error, attempt ${attempt}/${maxRetries}, waiting ${retryDelay}ms...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }

      console.error(`Failed to post to Facebook: ${errorMessage}`);

      logPost({
        tweet_id: "fb_failed_" + Date.now(),
        text,
        image_path: imagePath ?? null,
        posted_at: new Date().toISOString(),
        status: "failed",
        platform: "facebook",
      });

      // Auth errors
      if (errorCode === 190 || errorCode === 200 || errorMessage.includes("access token")) {
        return { success: false, error: "Auth error - check Facebook pageAccessToken in config.ts" };
      }

      // Rate limiting
      if (errorCode === 32 || errorCode === 4 || errorMessage.includes("limit")) {
        return { success: false, error: "Rate limited by Facebook API" };
      }

      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

class FbApiError extends Error {
  code: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code || 0;
  }
}
