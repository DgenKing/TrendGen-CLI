import fs from 'fs/promises';
import path from 'path';

interface LogEntry {
  timestamp: string;
  step: string;
  data: any;
  details?: string;
}

export class Logger {
  private logEntries: LogEntry[] = [];
  private businessName: string;
  private quiet: boolean;

  constructor(businessName: string, quiet: boolean = false) {
    this.businessName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
    this.quiet = quiet;
  }

  log(step: string, data: any, details?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      data,
      details
    };

    this.logEntries.push(entry);
    if (!this.quiet) {
      console.error(`[PROCESS LOG] ${step}:`, data);
    }
  }

  progress(message: string) {
    if (!this.quiet) {
      console.error(message);
    }
  }

  async saveToFile(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `process_log_${this.businessName}_${timestamp}.txt`;
    const logDir = path.join(process.cwd(), 'logs', 'process_logs');
    const filepath = path.join(logDir, filename);

    // Ensure process_logs directory exists
    await fs.mkdir(logDir, { recursive: true });

    let content = '';
    content += '='.repeat(80) + '\n';
    content += `BUSINESS TREND ANALYSIS PROCESS LOG\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += '='.repeat(80) + '\n\n';

    for (const entry of this.logEntries) {
      content += `[${entry.timestamp}] ${entry.step}\n`;
      content += '-'.repeat(50) + '\n';

      if (entry.details) {
        content += `Details: ${entry.details}\n\n`;
      }

      if (typeof entry.data === 'object') {
        content += JSON.stringify(entry.data, null, 2) + '\n';
      } else {
        content += `${entry.data}\n`;
      }

      content += '\n' + '='.repeat(80) + '\n\n';
    }

    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  // Helper methods for specific logging scenarios
  logInput(businessData: any) {
    this.log('INPUT_RECEIVED', businessData, 'Initial business data provided by user');
  }

  logKeywordGeneration(keywords: string[], prompt: string) {
    this.log('KEYWORDS_GENERATED', {
      keywords,
      count: keywords.length,
      ai_prompt_used: prompt
    }, 'AI-generated keywords based on business data');
  }

  logGoogleSearch(keywords: string[], results: string[]) {
    this.log('GOOGLE_TRENDS_SEARCH', {
      search_keywords: keywords,
      suggestions_found: results,
      count: results.length
    }, 'Google autocomplete suggestions fetched');
  }

  logRedditSearch(keywords: string[], discussions: any[]) {
    this.log('REDDIT_SEARCH', {
      search_keywords: keywords,
      discussions_found: discussions.map(d => ({
        title: d.title,
        subreddit: d.subreddit,
        score: d.score,
        comments: d.comments,
        url: d.url
      })),
      count: discussions.length
    }, 'Reddit discussions searched across UK subreddits');
  }

  logXcomTrends(trends: string[]) {
    this.log('XCOM_TRENDS', {
      uk_trends: trends,
      count: trends.length
    }, 'Current UK trending topics from X.com');
  }

  logCoingeckoTrends(trends: any[]) {
    this.log('COINGECKO_TRENDING', {
      trending_coins: trends.map(c => ({
        name: c.name,
        symbol: c.symbol,
        rank: c.rank,
        price_change_24h: c.priceChange24h
      })),
      count: trends.length
    }, 'Trending cryptocurrencies from CoinGecko');
  }

  logCryptoNews(articles: any[]) {
    this.log('CRYPTO_AI_NEWS', {
      articles_found: articles.map(a => ({
        title: a.headline || a.title,
        link: a.url || a.link,
        pubDate: a.publishedAt || a.pubDate,
        description: a.description
      })),
      count: articles.length
    }, 'Crypto & AI news articles fetched');
  }

  logContentGeneration(postIdeas: any[], prompt: string) {
    this.log('CONTENT_IDEAS_GENERATED', {
      post_ideas: postIdeas,
      count: postIdeas.length,
      ai_prompt_used: prompt
    }, 'AI-generated social media content ideas based on trend analysis');
  }

  logCacheInfo(cached: boolean, processingTime: number) {
    this.log('PROCESSING_COMPLETE', {
      was_cached: cached,
      processing_time_seconds: processingTime,
      cache_status: cached ? 'Data retrieved from cache' : 'Fresh data analysis performed'
    }, 'Final processing statistics');
  }

  logError(step: string, error: any) {
    this.log('ERROR', {
      failed_step: step,
      error_message: error.message || error,
      error_type: error.name || 'Unknown'
    }, `Error occurred during ${step}`);
  }

  // === POST LOG HELPERS ===

  static snippetFromPost(text: string, wordCount: number = 6): string {
    return text
      .replace(/\n/g, ' ')
      .split(/\s+/)
      .slice(0, wordCount)
      .join(' ')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim();
  }

  static async logPost(businessName: string, platform: string, postText: string): Promise<void> {
    const postLogDir = path.join(process.cwd(), 'logs', 'post_logs');
    await fs.mkdir(postLogDir, { recursive: true });

    const snippet = Logger.snippetFromPost(postText);
    const safeName = businessName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${snippet.replace(/\s+/g, '_')}_${safeName}_${platform}_${timestamp}.txt`;
    const filepath = path.join(postLogDir, filename);

    const content =
      `SNIPPET: ${snippet}\n` +
      `BUSINESS: ${businessName}\n` +
      `PLATFORM: ${platform}\n` +
      `GENERATED: ${new Date().toISOString()}\n` +
      `${'='.repeat(60)}\n` +
      postText;

    await fs.writeFile(filepath, content, 'utf-8');
  }

  static async getRecentPostSnippets(limit: number = 50): Promise<string[]> {
    const postLogDir = path.join(process.cwd(), 'logs', 'post_logs');
    try {
      const files = await fs.readdir(postLogDir);
      const posts: string[] = [];
      for (const file of files.slice(-limit)) {
        const raw = await fs.readFile(path.join(postLogDir, file), 'utf-8');
        // Extract full post text (everything after the separator line)
        const separatorIndex = raw.indexOf('='.repeat(60));
        if (separatorIndex !== -1) {
          posts.push(raw.slice(separatorIndex + 60).trim());
        }
      }
      return posts;
    } catch {
      return [];
    }
  }
}
