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

  return `Create a ${platform} post for ${businessData.businessName} (${businessData.businessType}) based on this trending topic.${duplicateWarning}

Business Profile:
- Name: ${businessData.businessName}
- Type: ${businessData.businessType}
- Industry: ${businessData.industry}
- Audience: ${businessData.targetAudience}
- Services: ${businessData.servicesOffered}
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
- Write in the brand voice — direct, sharp, no corporate fluff
- React to the trend with a clear opinion or insight, not just a summary
- ${postTypeGuidelines.authenticity_note}
${businessData.businessPersonality ? `- Channel the brand personality fully: ${businessData.businessPersonality}` : ''}

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
- Include at least 2 high-value hashtags relevant to the industry
- Speak directly to the target audience`
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
    twitter: `${idea.concept} — this is worth watching. What's your take? 👇`,
    instagram: `${idea.concept}\n\nThis is one to watch closely. Drop your thoughts in the comments 👇`,
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
      strategy: "Value-First (Engagement) - Educate and help without selling",
      post_type: "Helpful tip, news reaction, or practical insight",
      content_rules: "- Deliver a clear insight or practical tip for the audience\n- React to the specific news or trend with your own opinion\n- Share what this means for the audience — what should they do or watch\n- NO self-promotion or 'follow me' language\n- Be direct and specific, not vague or generic",
      authenticity_note: "Sound like someone with real experience sharing genuine knowledge — confident, direct, no fluff",
      cta_guidelines: "NO promotional CTAs. End with a question or bold statement that invites replies. Examples: 'What's your biggest challenge with this?', 'Anyone else noticed this?', 'This changes everything.'"
    },
    authority_building: {
      strategy: "Authority Building - Position as the go-to expert in your niche",
      post_type: "Expert insight that shows real experience and authority",
      content_rules: "- Share a take based on real experience that positions you as an expert\n- Reference specific examples, results, or data\n- Demonstrate you understand the industry deeper than surface-level\n- Subtle credibility-building — let the insight speak for itself\n- Connect trends to practical business outcomes",
      authenticity_note: "Sound like someone who has been in the trenches — battle-tested and always one step ahead",
      cta_guidelines: "Soft engagement prompts. Examples: 'DM me if you want to know more', 'Been doing this for years — ask me anything', 'Book a free chat if this sounds like you'"
    },
    direct_sales: {
      strategy: "Direct Engagement - Drive enquiries and conversions",
      post_type: "Results-driven post with clear CTA",
      content_rules: "- Create urgency around a problem the audience faces\n- Make the audience feel they need to act NOW\n- Use specific numbers, results, or before/after comparisons\n- Bold claims backed by real experience\n- Show the transformation your service delivers",
      authenticity_note: "Sound like the most confident, straight-talking voice in the room — if you're not doing this, you're leaving money on the table",
      cta_guidelines: "Direct CTAs. Examples: 'DM me', 'Book a free chat', 'Drop AUTO below', 'Tag someone who needs this'"
    }
  };

  return guidelines[postType as keyof typeof guidelines] || guidelines.value_first;
}
