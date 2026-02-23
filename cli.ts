#!/usr/bin/env bun

import { runPipeline } from "./lib/pipeline";
import { config } from "./config";

interface CliArgs {
  platforms?: string[];
  strategy?: "value_first" | "authority_building" | "direct_sales";
  keywords?: string[];
  skipContent: boolean;
  quiet: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    skipContent: false,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--platforms":
        result.platforms = args[++i].split(",").map((p) => p.trim().toLowerCase());
        break;
      case "--strategy":
        result.strategy = args[++i] as any;
        break;
      case "--keywords":
        result.keywords = args[++i].split(",").map((k) => k.trim());
        break;
      case "--skip-content":
        result.skipContent = true;
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return result;
}

function printHelp() {
  console.log(`
TrendGen CLI - Business Content Trend Analysis

Usage:
  bun run cli.ts [options]

Options:
  --platforms <list>    Comma-separated: twitter,instagram,facebook (default: all)
  --strategy <type>      value_first, authority_building, or direct_sales
  --keywords <list>      Comma-separated keywords (skip AI generation)
  --skip-content         Stop after trend analysis, skip content generation
  --quiet                Suppress stderr progress, only JSON on stdout
  --help, -h             Show this help message

Examples:
  bun run cli.ts --platforms twitter
  bun run cli.ts --platforms twitter,instagram
  bun run cli.ts --strategy direct_sales --quiet > output.json
  bun run cli.ts --keywords "bitcoin,ethereum" --platforms twitter
`);
}

async function main() {
  // Random delay scheduling — generated here in code, not by OpenClaw
  if (config.schedule.enabled && config.schedule.randomDelayMinutes) {
    const maxDelay = config.schedule.intervalHours * 60 - 1;
    const delayMins = Math.floor(Math.random() * maxDelay) + 1;
    console.error(`[SCHEDULE] Waiting ${delayMins} minute(s) before running...`);
    await new Promise(resolve => setTimeout(resolve, delayMins * 60 * 1000));
  }

  const args = parseArgs((typeof Bun !== 'undefined' ? Bun.argv : process.argv).slice(2));
  const result = await runPipeline({
    platforms: args.platforms,
    strategy: args.strategy,
    keywords: args.keywords,
    skipContent: args.skipContent,
    quiet: args.quiet,
  });

  // Output JSON to stdout
  console.log(JSON.stringify(result, null, 2));

  // Exit with appropriate code
  if (result.status === "error") {
    process.exit(4); // AI content generation failed
  }

  // Check if all data sources failed
  if (result.meta.sourcesUsed.length === 0 && result.keywords.length > 0) {
    process.exit(3); // All data sources failed
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
