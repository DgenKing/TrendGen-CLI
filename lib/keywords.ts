import { makeRequest } from "./claude";
import { Business } from "../config";

interface KeywordInput {
  businessName: string;
  businessType: string;
  ukCity: string;
  industry: string;
  targetAudience: string;
  servicesOffered: string;
  businessPersonality?: string;
}

export async function generateKeywords(input: KeywordInput, logger?: any): Promise<string[]> {
  const prompt = buildKeywordPrompt(input);
  const content = await makeRequest(prompt, 1000);
  const keywords = parseKeywordsFromResponse(content);

  if (logger) {
    logger.logKeywordGeneration(keywords, prompt);
  }

  return keywords;
}

function buildKeywordPrompt(input: KeywordInput): string {
  const personalityContext = input.businessPersonality
    ? `- Business Personality & Values: ${input.businessPersonality}\n`
    : '';

  return `Generate relevant keywords for a crypto influencer & AI tech commentator's social media trend analysis.

Influencer Profile:
- Handle: ${input.businessName}
- Type: ${input.businessType}
- Industry: ${input.industry}
- Audience: ${input.targetAudience}
- Content: ${input.servicesOffered}
${personalityContext}
Generate 8-12 high-signal keywords that would be useful for:
1. Google Trends analysis (global crypto & AI searches)
2. Crypto news discovery (price moves, protocol updates, token launches)
3. AI/tech news discovery (model releases, agent frameworks, company news)
4. Community trending topics (CT, Reddit, Discord)
5. Audience search patterns
${input.businessPersonality ? '6. Keywords that align with the influencer personality and content style\n' : ''}
Focus on:
- Specific token tickers and protocol names (BTC, ETH, SOL, etc.)
- AI model and company names (Claude, GPT, Gemini, DeepSeek, etc.)
- Trending narratives (RWA, DeFi, agentic AI, etc.)
- High-signal search terms the crypto/AI community uses
${input.businessPersonality ? '- Keywords that reflect the influencer voice and niche' : ''}

Return ONLY a comma-separated list of keywords, no explanations:`;
}

function parseKeywordsFromResponse(content: string): string[] {
  try {
    // Extract keywords from the response
    const lines = content.split('\n');
    let keywordLine = '';

    for (const line of lines) {
      if (line.trim() && !line.includes(':') && line.includes(',')) {
        keywordLine = line.trim();
        break;
      }
    }

    if (!keywordLine) {
      keywordLine = content.trim();
    }

    return keywordLine
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0 && keyword.length < 50)
      .slice(0, 12);
  } catch (error) {
    console.error("Error parsing keywords:", error);
    return [];
  }
}
