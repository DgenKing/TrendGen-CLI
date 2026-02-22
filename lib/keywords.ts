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

  return `Generate relevant keywords for a UK business social media content analysis.

Business Details:
- Name: ${input.businessName}
- Type: ${input.businessType}
- Location: ${input.ukCity}
- Industry: ${input.industry}
- Target Audience: ${input.targetAudience}
- Services: ${input.servicesOffered}
${personalityContext}
Generate 8-12 relevant keywords that would be useful for:
1. Google Trends analysis in the UK
2. Social media trend discovery
3. Local search patterns
4. Industry-specific terminology
5. Target audience language preferences
${input.businessPersonality ? '6. Keywords that align with business personality and values\n' : ''}
Focus on:
- Local search terms (include city name where relevant)
- Industry-specific phrases
- Target audience interests
- Seasonal/trending terms for the business type
- UK spelling variants and colloquialisms
${input.businessPersonality ? '- Keywords that reflect the business personality and unique positioning' : ''}

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
