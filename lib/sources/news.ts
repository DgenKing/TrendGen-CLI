import { cache } from "../cache";
import { config } from "../../config";

interface NewsArticle {
  headline: string;
  url: string;
  publishedAt: string;
  relevance_score: number;
  description?: string;
}

export class NewsAnalysisService {
  private newsApiKey: string;

  // 50/50 Crypto + AI/Tech RSS feeds (no API key needed)
  private rssFeeds = [
    // Crypto feeds
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://cryptonews.com/feed/",
    // AI & emerging tech feeds
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://venturebeat.com/category/ai/feed/",
    "https://www.artificialintelligence-news.com/feed/",
  ];

  constructor() {
    this.newsApiKey = config.sources.news.newsApiKey || "";
  }

  async getRelevantArticles(keywords: string[], businessType: string, ukCity: string): Promise<NewsArticle[]> {
    // Skip if not enabled
    if (!config.sources.news.enabled) {
      return [];
    }

    const cacheKey = cache.generateKey("news-articles", { keywords: keywords.sort(), businessType, ukCity });

    // Check cache first (4 hours TTL for news)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const articles: NewsArticle[] = [];

      // Get articles from crypto/AI RSS feeds
      const rssArticles = await this.getRssArticles(keywords, businessType);
      articles.push(...rssArticles);

      // Try NewsAPI if key provided
      if (this.newsApiKey) {
        const newsApiArticles = await this.getNewsApiArticles(keywords, businessType);
        articles.push(...newsApiArticles);
      }

      // Filter and rank by relevance
      const relevantArticles = this.rankArticlesByRelevance(articles, keywords, businessType)
        .slice(0, 10);

      // Cache for 4 hours
      await cache.set(cacheKey, relevantArticles, 4 * 60 * 60);

      return relevantArticles;
    } catch (error) {
      console.error("Error fetching news articles:", error);
      return [];
    }
  }

  private async getNewsApiArticles(keywords: string[], businessType: string): Promise<NewsArticle[]> {
    try {
      const query = keywords.slice(0, 3).join(" OR ");
      const url = `https://newsapi.org/v2/top-headlines?country=gb&category=technology&q=${encodeURIComponent(query)}&apiKey=${this.newsApiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("NewsAPI rate limit exceeded");
          return [];
        }
        throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const articles = data.articles || [];

      return articles.map((article: any) => ({
        headline: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        description: article.description,
        relevance_score: 0.5
      }));
    } catch (error) {
      console.error("Error fetching NewsAPI articles:", error);
      return [];
    }
  }

  private async getRssArticles(keywords: string[], businessType: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    for (const feedUrl of this.rssFeeds) {
      try {
        const feedArticles = await this.parseFeed(feedUrl);
        articles.push(...feedArticles);
      } catch (error) {
        console.error(`Error parsing RSS feed ${feedUrl}:`, error);
      }
    }

    return articles;
  }

  private async parseFeed(feedUrl: string): Promise<NewsArticle[]> {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'TrendGen/1.0 (Crypto & AI News Aggregator)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
        }
      });

      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      return this.parseRssXml(xml);
    } catch (error) {
      console.error(`Error fetching RSS feed ${feedUrl}:`, error);
      return [];
    }
  }

  private parseRssXml(xml: string): NewsArticle[] {
    const articles: NewsArticle[] = [];

    try {
      // Simple XML parsing for RSS items
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i;
      const linkRegex = /<link>(.*?)<\/link>/i;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/i;
      const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i;

      let match;
      while ((match = itemRegex.exec(xml)) !== null && articles.length < 15) {
        const itemXml = match[1];

        const titleMatch = titleRegex.exec(itemXml);
        const linkMatch = linkRegex.exec(itemXml);
        const pubDateMatch = pubDateRegex.exec(itemXml);
        const descMatch = descRegex.exec(itemXml);

        if (titleMatch && linkMatch) {
          articles.push({
            headline: titleMatch[1] || titleMatch[2] || "",
            url: linkMatch[1] || "",
            publishedAt: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
            description: descMatch ? (descMatch[1] || descMatch[2]) : "",
            relevance_score: 0.3
          });
        }
      }
    } catch (error) {
      console.error("Error parsing RSS XML:", error);
    }

    return articles;
  }

  private rankArticlesByRelevance(articles: NewsArticle[], keywords: string[], businessType: string): NewsArticle[] {
    // Crypto/AI relevant terms for scoring
    const cryptoTerms = ["bitcoin", "btc", "ethereum", "eth", "crypto", "token", "blockchain", "defi", "nft", "web3", "exchange", "trading", "altcoin", "solana", "dogecoin", "memecoin", "coin", "price", "market", "bull", "bear", "pump", "dump"];
    const aiTerms = ["ai", "artificial intelligence", "machine learning", "ml", "deep learning", "neural", "chatgpt", "openai", "anthropic", "claude", "gemini", "gpt", "llm", "agent", "model", "transformer", "nvidia", "gpu", "copilot", "midjourney", "stable diffusion", "sam altman", "startup", "robot", "autonomous"];

    return articles.map(article => {
      let score = 0;
      const content = `${article.headline} ${article.description || ""}`.toLowerCase();

      // Check for keyword matches
      keywords.forEach(keyword => {
        if (content.includes(keyword.toLowerCase())) {
          score += 0.4;
        }
      });

      // Check for crypto terms
      cryptoTerms.forEach(term => {
        if (content.includes(term)) {
          score += 0.3;
        }
      });

      // Check for AI terms
      aiTerms.forEach(term => {
        if (content.includes(term)) {
          score += 0.3;
        }
      });

      // Boost recent articles
      const articleDate = new Date(article.publishedAt);
      const hoursAgo = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) {
        score += 0.2;
      } else if (hoursAgo < 48) {
        score += 0.1;
      }

      return {
        ...article,
        relevance_score: Math.min(1.0, score)
      };
    })
    .filter(article => article.relevance_score > 0.2)
    .sort((a, b) => b.relevance_score - a.relevance_score);
  }
}

export const newsAnalysisService = new NewsAnalysisService();
