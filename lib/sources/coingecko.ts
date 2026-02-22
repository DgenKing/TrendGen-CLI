import { cache } from "../cache";

export interface TrendingCoin {
  name: string;
  symbol: string;
  rank: number;
  priceBtc: number;
  marketCap: number;
  priceChange24h: number;
}

export class CoinGeckoService {
  private baseUrl = "https://api.coingecko.com/api/v3";
  private cacheTTL = 2 * 60 * 60; // 2 hours

  async getTrendingCoins(): Promise<TrendingCoin[]> {
    const cacheKey = "coingecko:trending";

    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/search/trending`, {
        headers: {
          "Accept": "application/json",
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const coins = this.parseTrendingResponse(data);

      // Cache the results
      await cache.set(cacheKey, coins, this.cacheTTL);

      return coins;
    } catch (error) {
      console.error("Error fetching CoinGecko trending:", error);
      return [];
    }
  }

  private parseTrendingResponse(data: any): TrendingCoin[] {
    try {
      const coins = data.coins || [];

      return coins.slice(0, 10).map((item: any) => ({
        name: item.item.name || "",
        symbol: item.item.symbol?.toUpperCase() || "",
        rank: item.item.market_cap_rank || 0,
        priceBtc: item.item.price_btc || 0,
        marketCap: item.item.market_cap || 0,
        priceChange24h: item.item.data?.price_change_percentage_24h?.usd ?? 0,
      }));
    } catch (error) {
      console.error("Error parsing CoinGecko response:", error);
      return [];
    }
  }
}

export const coinGeckoService = new CoinGeckoService();
