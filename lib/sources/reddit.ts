import { cache } from "../cache";
import { config } from "../../config";

interface RedditPost {
  title: string;
  score: number;
  subreddit: string;
  url: string;
  comments: number;
  created: number;
}

export class RedditAnalysisService {
  private clientId: string;
  private clientSecret: string;
  private userAgent: string;
  private accessToken: string | null = null;
  private tokenExpires: number = 0;

  constructor() {
    this.clientId = config.sources.reddit.clientId;
    this.clientSecret = config.sources.reddit.clientSecret;
    this.userAgent = "TrendGen:1.0.0 (by /u/trendgen)";
  }

  async getRelevantDiscussions(keywords: string[], ukCity: string): Promise<RedditPost[]> {
    // Skip if not enabled
    if (!config.sources.reddit.enabled || !this.clientId || !this.clientSecret) {
      return [];
    }

    const cacheKey = cache.generateKey("reddit-discussions", { keywords: keywords.sort(), ukCity });

    // Check cache first (2 hours TTL)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      await this.ensureAccessToken();

      const discussions: RedditPost[] = [];
      const subreddits = ["unitedkingdom", "AskUK", "britishproblems", "ukbusiness"];

      // Add city-specific subreddits if they exist
      const citySubreddits = this.getCitySubreddits(ukCity);
      subreddits.push(...citySubreddits);

      for (const subreddit of subreddits) {
        for (const keyword of keywords.slice(0, 5)) { // Limit to prevent rate limiting
          const posts = await this.searchSubreddit(subreddit, keyword);
          discussions.push(...posts);
        }
      }

      // Sort by relevance and recency
      const sortedDiscussions = discussions
        .sort((a, b) => (b.score + b.comments) - (a.score + a.comments))
        .slice(0, 15);

      // Cache for 2 hours
      await cache.set(cacheKey, sortedDiscussions, 2 * 60 * 60);

      return sortedDiscussions;
    } catch (error) {
      console.error("Error fetching Reddit discussions:", error);
      return [];
    }
  }

  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpires) {
      return;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Reddit API credentials not configured");
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.userAgent
        },
        body: "grant_type=client_credentials"
      });

      if (!response.ok) {
        throw new Error(`Reddit auth failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpires = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
    } catch (error) {
      console.error("Error getting Reddit access token:", error);
      throw error;
    }
  }

  private async searchSubreddit(subreddit: string, keyword: string): Promise<RedditPost[]> {
    try {
      if (!this.accessToken) {
        throw new Error("No Reddit access token");
      }

      const url = `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=5&restrict_sr=1&t=week`;

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "User-Agent": this.userAgent
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("Reddit rate limit hit, waiting...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          return [];
        }
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const posts = data.data?.children || [];

      return posts.map((post: any) => ({
        title: post.data.title,
        score: post.data.score,
        subreddit: post.data.subreddit,
        url: `https://reddit.com${post.data.permalink}`,
        comments: post.data.num_comments,
        created: post.data.created_utc
      }));
    } catch (error) {
      console.error(`Error searching r/${subreddit} for "${keyword}":`, error);
      return [];
    }
  }

  private getCitySubreddits(ukCity: string): string[] {
    const cityMap: Record<string, string[]> = {
      "london": ["london", "LondonSocialClub"],
      "manchester": ["manchester", "ManchesterUnited"],
      "birmingham": ["birmingham"],
      "liverpool": ["Liverpool"],
      "leeds": ["Leeds"],
      "bristol": ["bristol"],
      "newcastle": ["NewcastleUponTyne"],
      "nottingham": ["nottingham"],
      "edinburgh": ["Edinburgh"],
      "glasgow": ["glasgow"],
      "cardiff": ["Cardiff"],
      "belfast": ["northernireland"],
      "brighton": ["brighton"],
      "oxford": ["oxford"],
      "cambridge": ["cambridge"]
    };

    return cityMap[ukCity.toLowerCase()] || [];
  }
}

export const redditAnalysisService = new RedditAnalysisService();
