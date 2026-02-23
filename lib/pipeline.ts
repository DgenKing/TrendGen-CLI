import { rm, mkdir } from "fs/promises";
import { join } from "path";
import { config } from "../config";
import { generateKeywords } from "./keywords";
import { analyzeTrends, generatePostIdeas, PostIdea, TrendData } from "./trends";
import { generatePlatformContent, GeneratedContent } from "./content";
import { Logger } from "./logger";
import { saveCurrentPost, CurrentPost } from "./image";

export interface PipelineResult {
  status: "success" | "error";
  business: {
    name: string;
    type: string;
    city: string;
    industry: string;
  };
  keywords: string[];
  trends: TrendData;
  postIdeas: PostIdea[];
  content: GeneratedContent[];
  currentPost: CurrentPost | null;
  meta: {
    timestamp: string;
    processingTimeMs: number;
    sourcesUsed: string[];
    keywordCount: number;
    ideasGenerated: number;
    contentPieces: number;
  };
  error?: string;
}

export async function runPipeline(
  options: {
    platforms?: string[];
    strategy?: "value_first" | "authority_building" | "direct_sales";
    keywords?: string[];
    skipContent?: boolean;
    quiet?: boolean;
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const currentPostDir = join(process.cwd(), "current_post");
  await rm(currentPostDir, { recursive: true, force: true });
  await mkdir(currentPostDir, { recursive: true });

  const logger = new Logger(config.business.name, options.quiet);

  // Merge config with CLI args, mapping to the property names expected by consumer functions
  const businessData = {
    businessName: config.business.name,
    businessType: config.business.type,
    ukCity: config.business.city,
    industry: config.business.industry,
    targetAudience: config.business.targetAudience,
    servicesOffered: config.business.servicesOffered,
    businessPersonality: config.business.personality,
    postType: options.strategy || config.business.postType,
  };

  logger.logInput(businessData);

  const platforms = options.platforms || [...config.output.platforms];
  const sourcesUsed: string[] = [];

  if (config.sources.googleTrends) sourcesUsed.push("google");
  if (config.sources.xcom) sourcesUsed.push("xcom");
  if (config.sources.coingecko) sourcesUsed.push("coingecko");
  if (config.sources.reddit.enabled) sourcesUsed.push("reddit");
  if (config.sources.news.enabled) sourcesUsed.push("news");

  try {
    // Step 1: Generate or use provided keywords
    logger.progress("[1/4] Generating keywords...");
    const keywordsStart = Date.now();

    let keywords: string[];
    if (options.keywords && options.keywords.length > 0) {
      // CLI override takes priority
      keywords = options.keywords;
      logger.progress(`  Using CLI keywords: ${keywords.join(", ")}`);
      logger.logKeywordGeneration(keywords, "CLI override");
    } else if (config.output.keywords.filter(k => k.trim()).length > 0) {
      // Randomly pick from config pool (skip empty entries)
      const pool = config.output.keywords.filter(k => k.trim());
      const count = Math.min(config.output.keywordsPerRun, pool.length);
      keywords = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
      logger.progress(`  Pool pick: ${keywords.join(", ")}`);
      logger.logKeywordGeneration(keywords, "Pool pick from config");
    } else {
      // AI-generated keywords
      keywords = await generateKeywords(businessData, logger);
    }

    const keywordsTime = ((Date.now() - keywordsStart) / 1000).toFixed(1);
    logger.progress(`  done (${keywords.length} keywords, ${keywordsTime}s)`);

    // Step 2: Analyze trends
    logger.progress("[2/4] Analyzing trends...");
    const trendsStart = Date.now();

    const trendsData = await analyzeTrends(
      keywords,
      {
        businessType: businessData.businessType,
        ukCity: businessData.ukCity,
        industry: businessData.industry,
        postType: businessData.postType,
      },
      logger
    );

    const trendsTime = ((Date.now() - trendsStart) / 1000).toFixed(1);
    const trendCounts = [
      trendsData.google.length,
      trendsData.xcom.length,
      trendsData.reddit.length,
      trendsData.news.length,
    ].join(", ");
    logger.progress(`  done (${trendCounts}, ${trendsTime}s)`);

    // Step 3: Generate post ideas (pass recent posts so AI avoids repeating topics)
    logger.progress("[3/4] Generating post ideas...");
    const ideasStart = Date.now();

    const recentPosts = await Logger.getRecentPostSnippets(10);
    const postIdeas = await generatePostIdeas(businessData, trendsData, logger, recentPosts);
    const ideasTime = ((Date.now() - ideasStart) / 1000).toFixed(1);
    logger.progress(`  done (${postIdeas.length} ideas, ${ideasTime}s)`);

    let content: GeneratedContent[] = [];

    // Step 4: Generate platform content (if not skipped)
    if (!options.skipContent) {
      logger.progress("[4/4] Generating content...");
      const contentStart = Date.now();

      const ideasToGenerate = postIdeas.slice(0, config.output.maxContentPerIdea);
      content = await generatePlatformContent(businessData, ideasToGenerate, platforms);

      const contentTime = ((Date.now() - contentStart) / 1000).toFixed(1);
      logger.progress(`  done (${content.length} pieces, ${contentTime}s)`);
    }

    // Step 5: Save current post + optional image (50/50 roll)
    let currentPost: CurrentPost | null = null;
    if (content.length > 0) {
      logger.progress("[5/5] Saving current post (image roll)...");
      // Prefer twitter post for X.com image sizing; fall back to first available
      const twitterPost = content.find(c => c.platform === "twitter") || content[0];
      currentPost = await saveCurrentPost(twitterPost.platform, twitterPost.text, twitterPost.idea);
      const imageStatus = currentPost.imagePath ? `image saved` : `no image this run`;
      logger.progress(`  done (${imageStatus})`);
      logger.log("IMAGE_GENERATION", {
        generated: !!currentPost.imagePath,
        imagePath: currentPost.imagePath,
        platform: currentPost.platform,
      });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.progress(`Total: ${totalTime}s`);

    // Save log to file if enabled
    logger.logCacheInfo(false, (Date.now() - startTime) / 1000);
    if (config.output.logToFile) {
      await logger.saveToFile();
    }

    return {
      status: "success",
      business: {
        name: businessData.businessName,
        type: businessData.businessType,
        city: businessData.ukCity,
        industry: businessData.industry,
      },
      keywords: keywords.slice(0, config.output.maxKeywords),
      trends: trendsData,
      postIdeas: postIdeas.slice(0, config.output.maxPostIdeas),
      content,
      currentPost,
      meta: {
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        sourcesUsed,
        keywordCount: keywords.length,
        ideasGenerated: postIdeas.length,
        contentPieces: content.length,
      },
    };
  } catch (error: any) {
    logger.logError("pipeline", error);
    logger.progress(`Error: ${error.message}`);

    return {
      status: "error",
      business: {
        name: businessData.businessName,
        type: businessData.businessType,
        city: businessData.ukCity,
        industry: businessData.industry,
      },
      keywords: [],
      trends: { google: [], xcom: [], coingecko: [], reddit: [], news: [] },
      postIdeas: [],
      content: [],
      currentPost: null,
      meta: {
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        sourcesUsed,
        keywordCount: 0,
        ideasGenerated: 0,
        contentPieces: 0,
      },
      error: error.message,
    };
  }
}
