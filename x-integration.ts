#!/usr/bin/env -S bun --use-system-ca
// Social Media Auto-Posting + Commenting Integration
// Entry point for OpenClaw
//
// Usage:
//   bun run x -- --dry-run              # X only (default)
//   bun run x -- --fb --dry-run         # Facebook only
//   bun run x -- --x --fb --dry-run     # Both platforms
//   bun run x -- --fb --strategy value_first

import { config } from "./config";
import { runPipeline, PipelineResult } from "./lib/pipeline";
import { getTodayPostCount, getTodayFbPostCount } from "./lib/x-db";
import { postTweet } from "./lib/x-poster";
import { postToFacebook } from "./lib/fb-poster";
import { runCommentFlow } from "./lib/x-commenter";

type Strategy = "value_first" | "authority_building" | "direct_sales";

const STRATEGIES: Strategy[] = ["value_first", "authority_building", "direct_sales"];

interface CliFlags {
  x: boolean;
  fb: boolean;
  "post-only": boolean;
  "comment-only": boolean;
  "dry-run": boolean;
  image: boolean;
  strategy: Strategy | null;
  keywords: string[] | null;
}

function parseFlags(args: string[]): CliFlags {
  const flags: CliFlags = {
    x: false,
    fb: false,
    "post-only": false,
    "comment-only": false,
    "dry-run": false,
    image: false,
    strategy: null,
    keywords: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--x") flags.x = true;
    if (arg === "--fb") flags.fb = true;
    if (arg === "--post-only") flags["post-only"] = true;
    if (arg === "--comment-only") flags["comment-only"] = true;
    if (arg === "--dry-run") flags["dry-run"] = true;
    if (arg === "--image") flags.image = true;
    if (arg === "--strategy" && args[i + 1]) {
      flags.strategy = args[++i] as Strategy;
    }
    if (arg === "--keywords" && args[i + 1]) {
      flags.keywords = args[++i].split(",").map(k => k.trim());
    }
  }

  // Default: X only if no platform flags specified
  if (!flags.x && !flags.fb) {
    flags.x = true;
  }

  return flags;
}

function pickRandomStrategy(): Strategy {
  return STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
}

// Determine which pipeline platforms to request based on flags
function getPipelinePlatforms(flags: CliFlags): string[] {
  const platforms: string[] = [];
  if (flags.x) platforms.push("twitter");
  if (flags.fb) platforms.push("facebook");
  return platforms;
}

// === X.COM POST FLOW ===
async function runXPostFlow(
  pipelineResult: PipelineResult
): Promise<{ success: boolean; error?: string }> {
  console.log("\n=== X.COM POST FLOW ===\n");

  if (!config.x.enabled) {
    console.log("[SKIP] X integration is disabled in config.ts (x.enabled = false)");
    return { success: true };
  }

  const currentPostCount = getTodayPostCount();
  if (currentPostCount >= config.x.postsPerDay) {
    console.log(`[SKIP] X daily cap reached (${currentPostCount}/${config.x.postsPerDay})`);
    return { success: true };
  }

  console.log(`X posts today: ${currentPostCount}/${config.x.postsPerDay}`);

  // Find twitter content from pipeline result
  const twitterContent = pipelineResult.content.find(c => c.platform === "twitter");
  if (!twitterContent) {
    console.error("No Twitter content generated");
    return { success: false, error: "No Twitter content generated" };
  }

  const imagePath = pipelineResult.currentPost?.imagePath ?? null;

  console.log(`Post: ${twitterContent.text.substring(0, 100)}...`);

  const result = await postTweet(twitterContent.text, imagePath);

  if (result.success) {
    console.log("X post flow complete!");
    return { success: true };
  } else {
    console.error(`X post failed: ${result.error}`);
    return { success: false, error: result.error };
  }
}

// === FACEBOOK POST FLOW ===
async function runFbPostFlow(
  pipelineResult: PipelineResult
): Promise<{ success: boolean; error?: string }> {
  console.log("\n=== FACEBOOK POST FLOW ===\n");

  if (!config.facebook.enabled) {
    console.log("[SKIP] Facebook is disabled in config.ts (facebook.enabled = false)");
    return { success: true };
  }

  const currentFbCount = getTodayFbPostCount();
  if (currentFbCount >= config.facebook.postsPerDay) {
    console.log(`[SKIP] Facebook daily cap reached (${currentFbCount}/${config.facebook.postsPerDay})`);
    return { success: true };
  }

  console.log(`Facebook posts today: ${currentFbCount}/${config.facebook.postsPerDay}`);

  // Find facebook content from pipeline result
  const fbContent = pipelineResult.content.find(c => c.platform === "facebook");
  if (!fbContent) {
    console.error("No Facebook content generated");
    return { success: false, error: "No Facebook content generated" };
  }

  const imagePath = pipelineResult.currentPost?.imagePath ?? null;

  console.log(`Post: ${fbContent.text.substring(0, 100)}...`);

  const result = await postToFacebook(fbContent.text, imagePath);

  if (result.success) {
    console.log("Facebook post flow complete!");
    return { success: true };
  } else {
    console.error(`Facebook post failed: ${result.error}`);
    return { success: false, error: result.error };
  }
}

async function main() {
  const flags = parseFlags(process.argv);
  const strategy = flags.strategy || pickRandomStrategy();
  const platforms = getPipelinePlatforms(flags);

  console.log("=".repeat(50));
  console.log("Social Media Auto-Posting Integration");
  console.log("=".repeat(50));
  console.log(`Platforms: ${platforms.join(", ")}`);
  console.log(`Mode: ${flags["post-only"] ? "POST-ONLY" : flags["comment-only"] ? "COMMENT-ONLY" : "FULL"}`);
  console.log(`Strategy: ${strategy}${!flags.strategy ? " (random)" : ""}`);
  console.log(`Dry run: ${flags["dry-run"] ? "YES" : "NO"}`);
  if (flags.image) console.log(`Image: FORCED via --image flag`);
  if (flags.keywords) console.log(`Keywords: ${flags.keywords.join(", ")} (override)`);

  // Apply dry-run override to all platform configs
  if (flags["dry-run"]) {
    if (!config.x.dryRun) {
      (config.x as any).dryRun = true;
    }
    if (!config.facebook.dryRun) {
      (config.facebook as any).dryRun = true;
    }
    console.log("[DRY-RUN] Enabled via CLI flag");
  }

  // Jitter — adds organic randomness so posts don't look bot-like
  if (config.schedule.jitterMinutes && config.schedule.jitterMinutes > 0 && !flags["dry-run"]) {
    const jitterSecs = (Math.floor(Math.random() * config.schedule.jitterMinutes) + 1) * 60;
    console.log(`[JITTER] Waiting ${jitterSecs}s (${Math.floor(jitterSecs/60)}m) before posting...`);

    for (let remaining = jitterSecs; remaining > 0; remaining -= 10) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log(`[JITTER] ${remaining}s remaining...`);
    }
    console.log(`[JITTER] Go! Posting now.`);
  }

  let xSuccess = true;
  let fbSuccess = true;
  let commentSuccess = true;
  let xError: string | undefined;
  let fbError: string | undefined;
  let commentError: string | undefined;

  // Run post flows (unless comment-only)
  if (!flags["comment-only"]) {
    // Generate content for all requested platforms in one pipeline run
    console.log(`\nGenerating content (strategy: ${strategy})...`);
    const pipelineResult: PipelineResult = await runPipeline({
      platforms,
      strategy,
      keywords: flags.keywords || undefined,
      quiet: false,
      forceImage: flags.image,
    });

    if (pipelineResult.status === "error") {
      console.error(`Pipeline error: ${pipelineResult.error}`);
      xSuccess = false;
      fbSuccess = false;
      xError = pipelineResult.error;
      fbError = pipelineResult.error;
    } else {
      // Post to each platform
      if (flags.x) {
        const xResult = await runXPostFlow(pipelineResult);
        xSuccess = xResult.success;
        xError = xResult.error;
      }

      if (flags.fb) {
        const fbResult = await runFbPostFlow(pipelineResult);
        fbSuccess = fbResult.success;
        fbError = fbResult.error;
      }
    }
  }

  // Run comment flow (X.com only, unless post-only or fb-only)
  if (flags.x && !flags["post-only"] && !flags["comment-only"]) {
    console.log("\n");
    const commentResult = await runCommentFlow();
    commentSuccess = commentResult.success;
    if (commentResult.errors.length > 0) {
      commentError = commentResult.errors.join(", ");
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));

  if (flags.x && !flags["comment-only"]) {
    console.log(`X post flow: ${xSuccess ? "SUCCESS" : "FAILED"}${xError ? ` - ${xError}` : ""}`);
  }
  if (flags.fb && !flags["comment-only"]) {
    console.log(`Facebook post flow: ${fbSuccess ? "SUCCESS" : "FAILED"}${fbError ? ` - ${fbError}` : ""}`);
  }
  if (flags.x && !flags["post-only"]) {
    console.log(`Comment flow: ${commentSuccess ? "SUCCESS" : "FAILED"}${commentError ? ` - ${commentError}` : ""}`);
  }

  // Exit codes
  const allErrors = [xError, fbError, commentError].filter(Boolean);
  const hasAuthError = allErrors.some(e => e?.includes("Auth") || e?.includes("check config"));

  if (hasAuthError) {
    console.log("\n[EXIT 1] Auth error - check config.ts keys");
    process.exit(1);
  }

  console.log("\n[EXIT 0] Done");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
