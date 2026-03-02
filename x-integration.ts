#!/usr/bin/env -S bun --use-system-ca
// X.com Auto-Posting + Commenting Integration
// Entry point for OpenClaw

import { config } from "./config";
import { runPipeline, PipelineResult } from "./lib/pipeline";
import { getTodayPostCount } from "./lib/x-db";
import { postTweet } from "./lib/x-poster";
import { runCommentFlow } from "./lib/x-commenter";
import fs from "fs";
import path from "path";

interface CliFlags {
  "post-only": boolean;
  "comment-only": boolean;
  "dry-run": boolean;
}

function parseFlags(args: string[]): CliFlags {
  const flags: CliFlags = {
    "post-only": false,
    "comment-only": false,
    "dry-run": false,
  };

  for (const arg of args) {
    if (arg === "--post-only") flags["post-only"] = true;
    if (arg === "--comment-only") flags["comment-only"] = true;
    if (arg === "--dry-run") flags["dry-run"] = true;
  }

  return flags;
}

async function readCurrentPost(): Promise<{ text: string; imagePath: string | null } | null> {
  const postPath = path.join(process.cwd(), "current_post", "post.json");

  if (!fs.existsSync(postPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(postPath, "utf-8");
    const post = JSON.parse(content);
    return {
      text: post.text,
      imagePath: post.imagePath,
    };
  } catch (error) {
    console.error("Error reading current_post/post.json:", error);
    return null;
  }
}

async function runPostFlow(): Promise<{ success: boolean; error?: string }> {
  console.log("\n=== POST FLOW ===\n");

  // Check if X integration is enabled
  if (!config.x.enabled) {
    console.log("[SKIP] X integration is disabled in config.ts (x.enabled = false)");
    return { success: true };
  }

  // Apply dry-run override from CLI
  if (config.x.dryRun === false && process.argv.includes("--dry-run")) {
    (config.x as any).dryRun = true;
    console.log("[DRY-RUN] CLI flag overrides dryRun to true");
  }

  // Check daily post cap
  const currentPostCount = getTodayPostCount();
  if (currentPostCount >= config.x.postsPerDay) {
    console.log(`[SKIP] Daily post cap reached (${currentPostCount}/${config.x.postsPerDay})`);
    return { success: true };
  }

  console.log(`Posts today: ${currentPostCount}/${config.x.postsPerDay}`);

  // Generate content using existing pipeline
  console.log("Generating content...");
  const pipelineResult: PipelineResult = await runPipeline({
    platforms: ["twitter"],
    quiet: false,
  });

  if (pipelineResult.status === "error") {
    console.error(`Pipeline error: ${pipelineResult.error}`);
    return { success: false, error: pipelineResult.error };
  }

  // Read the generated post
  const currentPost = await readCurrentPost();
  if (!currentPost) {
    console.error("No post generated - pipeline may have failed");
    return { success: false, error: "No post generated" };
  }

  console.log(`\nGenerated post: ${currentPost.text.substring(0, 100)}...`);

  // Post to X
  const result = await postTweet(currentPost.text, currentPost.imagePath);

  if (result.success) {
    console.log("Post flow complete!");
    return { success: true };
  } else {
    console.error(`Post failed: ${result.error}`);
    return { success: false, error: result.error };
  }
}

async function main() {
  const flags = parseFlags(process.argv);

  console.log("=".repeat(50));
  console.log("X.com Auto-Posting + Commenting Integration");
  console.log("=".repeat(50));
  console.log(`Mode: ${flags["post-only"] ? "POST-ONLY" : flags["comment-only"] ? "COMMENT-ONLY" : "FULL"}`);
  console.log(`Dry run: ${flags["dry-run"] ? "YES" : "NO"}`);

  // If dry-run flag passed, apply to config
  if (flags["dry-run"] && !config.x.dryRun) {
    (config.x as any).dryRun = true;
    console.log("[DRY-RUN] Enabled via CLI flag");
  }

  // Jitter — adds organic randomness so posts don't look bot-like
  if (config.schedule.jitterMinutes && config.schedule.jitterMinutes > 0 && !flags["dry-run"]) {
    const jitterSecs = (Math.floor(Math.random() * config.schedule.jitterMinutes) + 1) * 60;
    console.log(`[JITTER] Waiting ${jitterSecs}s (${Math.floor(jitterSecs/60)}m) before posting...`);

    // Countdown every 10 seconds
    for (let remaining = jitterSecs; remaining > 0; remaining -= 10) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log(`[JITTER] ${remaining}s remaining...`);
    }
    console.log(`[JITTER] Go! Posting now.`);
  }

  let postSuccess = true;
  let commentSuccess = true;
  let postError: string | undefined;
  let commentError: string | undefined;

  // Run post flow (unless comment-only)
  if (!flags["comment-only"]) {
    const postResult = await runPostFlow();
    postSuccess = postResult.success;
    postError = postResult.error;
  }

  // Run comment flow (unless post-only)
  if (!flags["post-only"]) {
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

  if (!flags["comment-only"]) {
    console.log(`Post flow: ${postSuccess ? "SUCCESS" : "FAILED"}${postError ? ` - ${postError}` : ""}`);
  }
  if (!flags["post-only"]) {
    console.log(`Comment flow: ${commentSuccess ? "SUCCESS" : "FAILED"}${commentError ? ` - ${commentError}` : ""}`);
  }

  // Exit codes
  // 0 = success (even if caps hit - that's expected)
  // 1 = auth error - user needs to check config
  if (!postSuccess && (postError?.includes("Auth") || postError?.includes("check config"))) {
    console.log("\n[EXIT 1] Auth error - check config.ts keys");
    process.exit(1);
  }

  if (!commentSuccess && (commentError?.includes("Auth") || commentError?.includes("check config"))) {
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
