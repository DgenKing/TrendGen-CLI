import { config } from "../config";
import { TwitterApi } from "twitter-api-v2";
import { getClient } from "./x-poster";
import {
  getTodayCommentCount,
  hasRepliedToTweet,
  markTweetReplied,
  logComment,
  incrementCommentCount,
} from "./x-db";
import { makeRequest } from "./claude";

let twitterApiIoClient: TwitterApi | null = null;

interface SearchResult {
  id: string;
  text: string;
  author_username: string;
  author_name: string;
  created_at: string;
  like_count: number;
  query: string;
}

// Use twitterapi.io to search for tweets
async function searchTweetsTwitterApiIo(query: string): Promise<SearchResult[]> {
  if (!config.twitterApiIo.apiKey) {
    console.log(`[SKIP] No twitterapi.io API key configured`);
    return [];
  }

  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Latest&cursor=`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": config.twitterApiIo.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`twitterapi.io search failed for "${query}": ${response.status} ${errorText}`);
      return [];
    }

    const data = await response.json();
    const tweets = data.tweets || [];

    return tweets.map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      author_username: tweet.author?.userName || "unknown",
      author_name: tweet.author?.name || "unknown",
      created_at: tweet.createdAt || new Date().toISOString(),
      like_count: tweet.likeCount || 0,
      query,
    }));
  } catch (error: any) {
    console.error(`Error searching tweets for "${query}": ${error.message}`);
    return [];
  }
}

// Filter tweets based on criteria
function filterTweets(tweets: SearchResult[]): SearchResult[] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ourUsername = config.x?.username?.toLowerCase() || "autogendigital";
  const minLikes = config.x?.minLikesFilter || 1;

  return tweets.filter((tweet) => {
    // Skip if we've already replied to this tweet
    if (hasRepliedToTweet(tweet.id)) {
      return false;
    }

    // Skip own tweets
    if (tweet.author_username.toLowerCase() === ourUsername) {
      return false;
    }

    // Skip tweets older than 24 hours
    const tweetDate = new Date(tweet.created_at);
    if (tweetDate < oneDayAgo) {
      return false;
    }

    // Skip low engagement tweets (configurable threshold)
    if (tweet.like_count < minLikes) {
      return false;
    }

    return true;
  });
}

// Generate a reply using DeepSeek
async function generateReply(tweet: SearchResult, brandVoice: string): Promise<string> {
  const prompt = `You are ${brandVoice}.

You are replying to this tweet:
"${tweet.text}"

Reply by @${tweet.author_username}.

Requirements:
1. Give free value first (actual helpful advice)
2. Soft pitch about your experience with ${config.business.servicesOffered}
3. End with a question to engage them
4. Keep it under 280 characters
5. Be authentic - like a real ${config.business.type} would reply

Generate 1 reply:`;

  try {
    const reply = await makeRequest(prompt);
    return reply.trim();
  } catch (error: any) {
    console.error(`Error generating reply: ${error.message}`);
    // Use fallback from config
    return config.x?.fallbackReply || "Been there! Happy to chat if you need a hand — what's your biggest headache right now?";
  }
}

export interface CommentResult {
  success: boolean;
  tweetId?: string;
  originalTweetId?: string;
  error?: string;
  dryRun?: boolean;
}

// Post a reply to a tweet
async function postReply(originalTweetId: string, replyText: string): Promise<CommentResult> {
  const isDryRun = config.x.dryRun;

  if (isDryRun) {
    console.log(`[DRY RUN] Would reply to ${originalTweetId}: ${replyText.substring(0, 100)}...`);
    logComment({
      tweet_id: "dry_run_" + Date.now(),
      reply_to_tweet_id: originalTweetId,
      reply_to_user: "unknown",
      text: replyText,
      search_query: "dry_run",
      posted_at: new Date().toISOString(),
      status: "dry_run",
    });
    return { success: true, originalTweetId, dryRun: true };
  }

  try {
    const twitter = getClient();
    const tweet = await twitter.v2.tweet(replyText, {
      reply: { in_reply_to_tweet_id: originalTweetId },
    });

    console.log(`Reply posted successfully: ${tweet.data.id} (reply to ${originalTweetId})`);

    logComment({
      tweet_id: tweet.data.id,
      reply_to_tweet_id: originalTweetId,
      reply_to_user: "unknown",
      text: replyText,
      search_query: "unknown",
      posted_at: new Date().toISOString(),
      status: "success",
    });

    markTweetReplied(originalTweetId);
    incrementCommentCount();

    return { success: true, tweetId: tweet.data.id, originalTweetId };
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error";
    console.error(`Failed to post reply: ${errorMessage}`);

    logComment({
      tweet_id: "failed_" + Date.now(),
      reply_to_tweet_id: originalTweetId,
      reply_to_user: "unknown",
      text: replyText,
      search_query: "unknown",
      posted_at: new Date().toISOString(),
      status: "failed",
    });

    return { success: false, originalTweetId, error: errorMessage };
  }
}

// Main comment function - searches and replies
export async function runCommentFlow(): Promise<{ success: boolean; commentsPosted: number; errors: string[] }> {
  // Skip if twitterApiIo is disabled
  if (!config.twitterApiIo?.enabled) {
    console.log(`[SKIP] twitterApiIo disabled in config`);
    return { success: true, commentsPosted: 0, errors: [] };
  }

  const errors: string[] = [];
  let commentsPosted = 0;

  // Check if we can post comments today
  const currentCount = getTodayCommentCount();
  if (currentCount >= config.x.commentsPerDay) {
    console.log(`[SKIP] Daily comment cap reached (${currentCount}/${config.x.commentsPerDay})`);
    return { success: true, commentsPosted: 0, errors: [] };
  }

  const commentsRemaining = config.x.commentsPerDay - currentCount;
  console.log(`Searching for tweets to comment on (${commentsRemaining} remaining today)...`);

  // Build search queries from config
  let queries: string[] = [
    ...config.twitterApiIo.searchQueries,
    ...config.twitterApiIo.searchHashtags,
  ];

  // OPTIMIZATION: Rotate queries based on time of day to spread usage
  // This ensures we don't always use the same queries, reducing API load per query
  const hourOfDay = new Date().getHours();
  const rotationIndex = hourOfDay % Math.max(1, Math.ceil(queries.length / 4));
  // Rotate: take a slice of 4 queries, wrapped around
  if (queries.length > 4) {
    queries = [
      ...queries.slice(rotationIndex, rotationIndex + 4),
      ...queries.slice(0, Math.max(0, rotationIndex + 4 - queries.length))
    ].slice(0, 4);
    console.log(`[ROTATION] Using queries ${rotationIndex}-${rotationIndex + 4}: ${queries.join(", ")}`);
  } else {
    console.log(`[ROTATION] Using ${queries.length} queries: ${queries.join(", ")}`);
  }

  // Search with early stopping optimization
  const allTweets: SearchResult[] = [];
  const minCandidatesNeeded = 5; // Stop early if we have enough candidates (need buffer for filtering)
  let earlyStopped = false;

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 5500)); // 5.5s delay — free tier is 1 req per 5s
    const tweets = await searchTweetsTwitterApiIo(query);
    allTweets.push(...tweets);
    console.log(`Found ${tweets.length} tweets for query: "${query}"`);

    // EARLY STOPPING: Check if we have enough candidates after each query
    const currentFiltered = filterTweets(allTweets);
    if (currentFiltered.length >= minCandidatesNeeded) {
      console.log(`[EARLY STOP] Have ${currentFiltered.length} candidates (needed ${minCandidatesNeeded}) - stopping search`);
      earlyStopped = true;
      break;
    }
  }

  if (!earlyStopped) {
    console.log(`[FULL SEARCH] Ran all ${queries.length} queries`);
  }

  // Filter tweets
  const filteredTweets = filterTweets(allTweets);
  console.log(`Filtered down to ${filteredTweets.length} eligible tweets`);

  // Pick up to 10 best candidates
  const candidates = filteredTweets
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, Math.min(10, commentsRemaining));

  // Generate and post replies
  for (const tweet of candidates) {
    // Check daily cap again
    if (getTodayCommentCount() >= config.x.commentsPerDay) {
      console.log(`[SKIP] Daily comment cap reached mid-run`);
      break;
    }

    console.log(`\nReplying to: ${tweet.text.substring(0, 80)}...`);
    console.log(`Author: @${tweet.author_username} | Likes: ${tweet.like_count}`);

    const replyText = await generateReply(tweet, config.business.personality);
    console.log(`Generated reply: ${replyText.substring(0, 80)}...`);

    const result = await postReply(tweet.id, replyText);

    if (result.success) {
      commentsPosted++;
    } else {
      errors.push(result.error || "Unknown error");
    }

    // Small delay between posts to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\nComment flow complete: ${commentsPosted} comments posted`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.join(", ")}`);
  }

  return { success: true, commentsPosted, errors };
}
