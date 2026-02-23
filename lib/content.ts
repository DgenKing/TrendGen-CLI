import { makeRequest } from "./claude";
import { Logger } from "./logger";
import { PostIdea } from "./trends";

export interface GeneratedContent {
  idea: string;
  platform: string;
  text: string;
  strategy: string;
}

interface BusinessDataInput {
  businessName: string;
  businessType: string;
  ukCity: string;
  industry: string;
  targetAudience: string;
  servicesOffered: string;
  businessPersonality?: string;
  postType?: string;
}

export async function generatePlatformContent(
  businessData: {
    businessName: string;
    businessType: string;
    ukCity: string;
    industry: string;
    targetAudience: string;
    servicesOffered: string;
    businessPersonality?: string;
    postType?: string;
  },
  selectedIdeas: PostIdea[],
  platforms: string[]
): Promise<GeneratedContent[]> {
  const generatedContent: GeneratedContent[] = [];

  for (const idea of selectedIdeas) {
    for (const platform of platforms) {
      try {
        const content = await generateContentForPlatform(businessData, idea, platform);
        generatedContent.push({
          idea: idea.concept,
          platform,
          text: content,
          strategy: businessData.postType || 'value_first'
        });
      } catch (error) {
        console.error(`Error generating content for ${platform}:`, error);
        generatedContent.push({
          idea: idea.concept,
          platform,
          text: getFallbackContent(idea, platform),
          strategy: businessData.postType || 'value_first'
        });
      }
    }
  }

  return generatedContent;
}

async function generateContentForPlatform(
  businessData: BusinessDataInput,
  idea: PostIdea,
  platform: string
): Promise<string> {
  const recentSnippets = await Logger.getRecentPostSnippets(10);
  if (recentSnippets.length > 0) {
    console.error(`[DUPLICATE CHECK] Found ${recentSnippets.length} recent post(s) — injecting into prompt to avoid repetition`);
  } else {
    console.error(`[DUPLICATE CHECK] No previous posts found — generating fresh`);
  }
  const prompt = buildContentPrompt(businessData, idea, platform, recentSnippets);
  const content = await makeRequest(prompt, 1000);
  const cleaned = cleanupGeneratedContent(content, platform);
  await Logger.logPost(businessData.businessName, platform, cleaned);
  return cleaned;
}

function buildContentPrompt(businessData: BusinessDataInput, idea: PostIdea, platform: string, recentSnippets: string[] = []): string {
  const platformSpecs = getPlatformSpecs(platform);
  const personalityContext = businessData.businessPersonality
    ? `- Business Personality & Values: ${businessData.businessPersonality}\n`
    : '';

  const postTypeGuidelines = getPostTypeContentGuidelines(businessData.postType || 'value_first');

  const duplicateWarning = recentSnippets.length > 0
    ? `\nRECENT POSTS — avoid duplicating content AND structure/format:\n${recentSnippets.map((s, i) => `[${i + 1}] ${s}`).join('\n')}\nDo NOT reuse the same post format (e.g. if a recent post used a numbered list, use a different format like a single paragraph, a question, a bold statement, or a two-liner instead).\n`
    : '';

  return `Create a ${platform} post for a crypto influencer & AI tech commentator based on this trending topic.${duplicateWarning}

Influencer Profile:
- Handle: ${businessData.businessName}
- Type: ${businessData.businessType}
- Industry: ${businessData.industry}
- Audience: ${businessData.targetAudience}
- Content: ${businessData.servicesOffered}
${personalityContext}
Post Concept: ${idea.concept}
Trend Source: ${idea.trend_source}

Content Strategy: ${postTypeGuidelines.strategy}
Post Type: ${postTypeGuidelines.post_type}

Platform: ${platform}
Requirements:
${platformSpecs.requirements}

Content Guidelines:
${postTypeGuidelines.content_rules}

Style Guidelines:
- Write as a crypto/AI influencer — direct, sharp, no corporate fluff
- React to the trend with a clear opinion or insight, not just a summary
- ${postTypeGuidelines.authenticity_note}
${businessData.businessPersonality ? '- Channel the influencer personality fully — degen energy, alpha mindset, community-first' : ''}

Call-to-Action Guidelines:
${postTypeGuidelines.cta_guidelines}

Return ONLY the post content, no explanations or formatting markers:`;
}

function getPlatformSpecs(platform: string): { requirements: string } {
  const specs: Record<string, { requirements: string }> = {
    twitter: {
      requirements: `- STRICT 280 character limit — count carefully, the post MUST be under 280 characters including hashtags and emojis. Do NOT exceed this limit.
- Include 2-4 high-value hashtags (counted within the 280 limit) — must include at least 2, choose specific and relevant ones not just generic tags
- Engaging and concise
- Can include emojis sparingly
- Vary the format — choose ONE style: a punchy single statement, a hot take, a question, a two-liner, or a short paragraph. Avoid defaulting to numbered lists every time.
- Call-to-action or conversation starter`
    },
    instagram: {
      requirements: `- Maximum 2,200 characters but aim for 125-150 words
- Include 5-10 high-value hashtags at the end — must include at least 2 specific, trending hashtags relevant to the topic and industry
- Multiple paragraphs with line breaks
- Engaging story or valuable information
- Include emojis naturally
- Encourage comments and engagement`
    },
    facebook: {
      requirements: `- 40-80 words for optimal engagement
- Conversational and community-focused
- Ask questions to encourage comments
- Include at least 2 high-value hashtags — crypto/AI specific, not generic ones
- Speak to the global crypto and AI community`
    }
  };

  return specs[platform] || specs.twitter;
}

function cleanupGeneratedContent(content: string, platform: string): string {
  let cleaned = content.trim();

  const prefixes = ["Here's the post:", "Post content:", "Caption:", "Tweet:", "Content:"];
  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
  }

  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }

  if (platform === "twitter" && cleaned.length > 280) {
    // Smart truncation: find a natural break point instead of chopping mid-word
    const slice = cleaned.substring(0, 280);

    // Try to cut at last paragraph break
    const lastPara = slice.lastIndexOf('\n\n');
    if (lastPara > 150) {
      cleaned = slice.substring(0, lastPara).trim();
    } else {
      // Try last sentence boundary
      const lastSentence = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! ')
      );
      if (lastSentence > 150) {
        cleaned = slice.substring(0, lastSentence + 1).trim();
      } else {
        // Last resort: cut at last space and add ellipsis
        const lastSpace = slice.lastIndexOf(' ', 277);
        cleaned = slice.substring(0, lastSpace > 0 ? lastSpace : 277).trim() + "...";
      }
    }
  } else if (platform === "instagram") {
    if (!cleaned.includes('\n\n#') && cleaned.includes('#')) {
      const hashtagIndex = cleaned.indexOf('#');
      const beforeHashtags = cleaned.substring(0, hashtagIndex).trim();
      const hashtags = cleaned.substring(hashtagIndex);
      cleaned = `${beforeHashtags}\n\n${hashtags}`;
    }
  }

  return cleaned;
}

function getFallbackContent(idea: PostIdea, platform: string): string {
  const fallbackContent: Record<string, string> = {
    twitter: `${idea.concept} — this is worth watching. What's your take? 👇 #Crypto #AI`,
    instagram: `${idea.concept}\n\nThis is one to watch closely. Drop your thoughts in the comments 👇\n\n#Crypto #Bitcoin #AITech #Web3 #DeFi`,
    facebook: `${idea.concept} — what do you think about this? Share your take in the comments, would love to hear from the community.`
  };

  return fallbackContent[platform] || fallbackContent.twitter;
}

function getPostTypeContentGuidelines(postType: string): {
  strategy: string;
  post_type: string;
  content_rules: string;
  authenticity_note: string;
  cta_guidelines: string;
} {
  const guidelines = {
    value_first: {
      strategy: "Value-First (Engagement) - Drop alpha, educate, and entertain without shilling",
      post_type: "News reaction, market insight, or alpha drop",
      content_rules: "- Deliver a clear insight, hot take, or market observation\n- React to the specific news or trend with your own opinion\n- Share what this means for the audience — what should they do or watch\n- NO self-promotion or 'follow me' language\n- Be direct and specific, not vague or generic",
      authenticity_note: "Sound like a sharp crypto/AI insider dropping knowledge to your community — confident, direct, no fluff",
      cta_guidelines: "NO promotional CTAs. End with a question, a poll prompt, or a bold statement that invites replies. Examples: 'Are you watching this?', 'What's your target?', 'This is just the start.'"
    },
    authority_building: {
      strategy: "Authority Building - Position as the go-to source for crypto & AI alpha",
      post_type: "Expert analysis that shows you called it",
      content_rules: "- Share a contrarian or early take that positions you ahead of the crowd\n- Reference specific data, chart patterns, or on-chain signals\n- Demonstrate you understand the market deeper than surface-level\n- Subtle credibility-building — let the insight speak for itself\n- Connect crypto and AI trends where relevant",
      authenticity_note: "Sound like someone who has been in the trenches — battle-tested, analytical, and always one step ahead",
      cta_guidelines: "Soft engagement prompts. Examples: 'Follow for more alpha before it hits CT', 'Been watching this for weeks — thread incoming', 'DM me if you want the full breakdown'"
    },
    direct_sales: {
      strategy: "Direct Engagement - Drive follows, shares, and community interaction",
      post_type: "High-energy FOMO or community rally post",
      content_rules: "- Create urgency around a market move, model release, or breaking news\n- Make the audience feel they need to act — follow, share, or comment NOW\n- Use numbers, percentages, or specific tickers to make it concrete\n- Bold claims backed by the trend data\n- Reward engagement with a promise of more alpha",
      authenticity_note: "Sound like the loudest, most confident voice in the room — if you're not watching this, you're ngmi",
      cta_guidelines: "Direct, high-energy CTAs. Examples: 'RT if you're long', 'Drop your price target below', 'Follow or miss the next call', 'Tag someone who needs to see this'"
    }
  };

  return guidelines[postType as keyof typeof guidelines] || guidelines.value_first;
}
