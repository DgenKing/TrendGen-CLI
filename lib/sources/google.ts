import { cache } from "../cache";

export class GoogleTrendsService {
  private baseUrl = "https://suggestqueries.google.com/complete/search";

  async getAutocompleteSuggestions(keywords: string[], location: string): Promise<string[]> {
    const cacheKey = cache.generateKey("google-trends", { keywords: keywords.sort(), location });

    // Check cache first (2 hours TTL)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const suggestions = new Set<string>();

      for (const keyword of keywords) {
        const keywordSuggestions = await this.getKeywordSuggestions(keyword, location);
        keywordSuggestions.forEach(suggestion => suggestions.add(suggestion));
      }

      const result = Array.from(suggestions).slice(0, 30);

      // Cache for 2 hours
      await cache.set(cacheKey, result, 2 * 60 * 60);

      return result;
    } catch (error) {
      console.error("Error fetching Google trends:", error);
      return [];
    }
  }

  private async getKeywordSuggestions(keyword: string, location: string): Promise<string[]> {
    try {
      const params = new URLSearchParams({
        client: "firefox",
        q: keyword,
        gl: "GB", // UK geolocation
        hl: "en-GB", // UK English
      });

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // client=firefox returns plain JSON: ["query",["suggestion1","suggestion2",...]]
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return [];
      }

      const suggestions = data[1] || [];

      return suggestions
        .filter((suggestion: string) => suggestion && suggestion.length > 0)
        .slice(0, 10);
    } catch (error) {
      console.error(`Error fetching suggestions for keyword "${keyword}":`, error);
      return [];
    }
  }
}

export const googleTrendsService = new GoogleTrendsService();
