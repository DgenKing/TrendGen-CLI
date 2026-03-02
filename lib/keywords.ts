import { makeRequest } from "./claude";
import { Business, config } from "../config";

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

  // Get prompt config or use defaults
  const keywordFocus = config.prompts?.keywordFocus?.join('\n') || "Industry trends, AI tools, audience pain points";
  const keywordExamples = config.prompts?.keywordExamples?.join('\n') || "Industry terms, AI tool names, pain points";

  return `Generate relevant keywords for ${input.businessName} (${input.businessType}) social media content.

Business Profile:
- Handle: ${input.businessName}
- Type: ${input.businessType}
- Industry: ${input.industry}
- Audience: ${input.targetAudience}
- Services: ${input.servicesOffered}
${personalityContext}
Generate 8-12 high-signal keywords that would be useful for:
1. Google Trends analysis (searches your target audience makes)
2. News discovery relevant to the industry
3. AI/tech news discovery (tools and trends)
4. Community trending topics
5. Audience search patterns and pain points
${input.businessPersonality ? '6. Keywords that align with the business personality and content style\n' : ''}

Focus on:
${keywordFocus}

Example keyword types:
${keywordExamples}

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
