import type { PluginAPI } from 'openclaw';

export default function register(api: PluginAPI) {
  // Register the analyze_trends tool
  api.registerTool({
    name: 'analyze_trends',
    description: 'Analyze trends across multiple data sources (Reddit, Google, X, CoinGecko, News)',
    parameters: {
      platforms: {
        type: 'array',
        items: { type: 'string' },
        required: false,
        description: 'Data sources to analyze (reddit, google, x, coingecko, news)'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        required: false,
        description: 'Specific keywords to track (skip AI generation)'
      },
      strategy: {
        type: 'string',
        required: false,
        description: 'Content strategy: value_first, authority_building, or direct_sales'
      }
    },
    async execute({ platforms, keywords, strategy }) {
      // This tool delegates to the skill for trend analysis
      // The skill uses browser tools to fetch trend data
      return {
        status: 'pending',
        message: 'Use the trend-gen skill for trend analysis'
      };
    }
  });

  // Register the generate_content tool
  api.registerTool({
    name: 'generate_trend_content',
    description: 'Generate social media content based on trending topics',
    parameters: {
      platform: {
        type: 'string',
        required: true,
        description: 'Target platform: twitter, instagram, or facebook'
      },
      trends: {
        type: 'array',
        items: { type: 'string' },
        required: true,
        description: 'Trending topics to base content on'
      },
      strategy: {
        type: 'string',
        required: false,
        default: 'value_first',
        description: 'Content strategy: value_first, authority_building, or direct_sales'
      }
    },
    async execute({ platform, trends, strategy }) {
      return {
        status: 'pending',
        message: 'Use the trend-gen skill for content generation'
      };
    }
  });

  console.log('TrendGen Claw Pack loaded successfully');
}
