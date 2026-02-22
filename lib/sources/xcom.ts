import { cache } from "../cache";

export class XcomScraperService {
  private trendUrl = "https://getdaytrends.com/united-kingdom/";

  async getUKTrends(): Promise<string[]> {
    const cacheKey = "xcom-trends:uk";

    // Check cache first (2 hours TTL)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const trends = await this.scrapeTrends();

      // Cache for 2 hours
      await cache.set(cacheKey, trends, 2 * 60 * 60);

      return trends;
    } catch (error) {
      console.error("Error scraping X.com trends:", error);
      return this.getFallbackTrends();
    }
  }

  private async scrapeTrends(): Promise<string[]> {
    try {
      const response = await fetch(this.trendUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse trending hashtags from HTML
      const trends = this.parseHtmlForTrends(html);

      return trends.slice(0, 20);
    } catch (error) {
      console.error("Error in scrapeTrends:", error);
      throw error;
    }
  }

  private parseHtmlForTrends(html: string): string[] {
    const trends: string[] = [];

    try {
      // Match exact pattern: <a href="/united-kingdom/trend/TOPIC_NAME/">Topic Name</a>
      // This captures only actual trending topics, not navigation
      const anchorPattern = /<a[^>]+href=["']\/united-kingdom\/trend\/([^"'\/]+)\/["'][^>]*>([^<]+)<\/a>/gi;
      let match;
      while ((match = anchorPattern.exec(html)) !== null && trends.length < 25) {
        const urlTopic = match[1];
        const text = match[2].trim();

        // URL-decode the topic name
        let decoded = decodeURIComponent(urlTopic);
        let finalTopic: string;

        // If it starts with %23 or #, keep the hashtag
        if (decoded.startsWith('%23') || decoded.startsWith('#')) {
          finalTopic = decoded.replace('%23', '#');
        } else {
          // Plain text, no forced # prefix
          finalTopic = decoded;
        }

        // Skip if empty or looks like garbage
        if (finalTopic && finalTopic.length > 1 && finalTopic.length < 50) {
          trends.push(finalTopic);
        }
      }

      // Remove duplicates and clean up
      return Array.from(new Set(trends))
        .filter(trend => trend.length > 2 && trend.length < 40)
        .slice(0, 15);

    } catch (error) {
      console.error("Error parsing HTML for trends:", error);
      return [];
    }
  }

  private getFallbackTrends(): string[] {
    return [
      "#UKNews",
      "#Britain",
      "#London",
      "#Manchester",
      "#Birmingham",
      "#CostOfLiving",
      "#UKBusiness",
      "#LocalBusiness",
      "#UKWeather",
      "#BritishPolitics"
    ];
  }
}

export const xcomScraperService = new XcomScraperService();
