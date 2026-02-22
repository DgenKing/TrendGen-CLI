import { makeRequest } from "./claude";
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
  const prompt = buildContentPrompt(businessData, idea, platform);
  const content = await makeRequest(prompt, 1000);
  return cleanupGeneratedContent(content, platform);
}

function buildContentPrompt(businessData: BusinessDataInput, idea: PostIdea, platform: string): string {
  const platformSpecs = getPlatformSpecs(platform);
  const personalityContext = businessData.businessPersonality
    ? `- Business Personality & Values: ${businessData.businessPersonality}\n`
    : '';

  const postTypeGuidelines = getPostTypeContentGuidelines(businessData.postType || 'value_first');

  return `Create a ${platform} post for a UK business based on this trending topic.

Business Details:
- Name: ${businessData.businessName}
- Type: ${businessData.businessType}
- Location: ${businessData.ukCity}
- Industry: ${businessData.industry}
- Target Audience: ${businessData.targetAudience}
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
- Authentic and conversational tone suitable for UK audience
- Connect the trending topic naturally to the business
- Use UK spelling and terminology
- ${postTypeGuidelines.authenticity_note}
${businessData.businessPersonality ? '- Reflect the business personality and values in the content tone and messaging' : ''}

Call-to-Action Guidelines:
${postTypeGuidelines.cta_guidelines}

Return ONLY the post content, no explanations or formatting markers:`;
}

function getPlatformSpecs(platform: string): { requirements: string } {
  const specs: Record<string, { requirements: string }> = {
    twitter: {
      requirements: `- STRICT 280 character limit — count carefully, the post MUST be under 280 characters including hashtags and emojis. Do NOT exceed this limit.
- Include 2-4 relevant hashtags (counted within the 280 limit)
- Engaging and concise
- Can include emojis sparingly
- Call-to-action or conversation starter`
    },
    instagram: {
      requirements: `- Maximum 2,200 characters but aim for 125-150 words
- Include 5-10 relevant hashtags at the end
- Multiple paragraphs with line breaks
- Engaging story or valuable information
- Include emojis naturally
- Encourage comments and engagement`
    },
    facebook: {
      requirements: `- 40-80 words for optimal engagement
- Conversational and community-focused
- Ask questions to encourage comments
- Include 1-3 relevant hashtags
- Focus on local community connection`
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
    twitter: `Excited about ${idea.concept}! What do you think? #LocalBusiness #Community`,
    instagram: `We're thinking about ${idea.concept}... what are your thoughts?\n\nLet us know in the comments! 👇\n\n#LocalBusiness #Community #YourThoughts`,
    facebook: `We'd love to hear your thoughts on ${idea.concept}. What do you think about this trend? Share your views in the comments!`
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
      strategy: "Value-First (Engagement) - Build trust and provide genuine value without selling",
      post_type: "Educational, helpful, or entertaining content",
      content_rules: "- Provide useful tips, insights, or information\n- Share behind-the-scenes or process content\n- Offer helpful observations about trends\n- NO selling, promotional language, or calls-to-action\n- Focus entirely on helping or entertaining the audience",
      authenticity_note: "Sound like a knowledgeable local person sharing genuinely helpful information",
      cta_guidelines: "NO calls-to-action. No 'contact us', 'book now', or any promotional language. End with questions to encourage engagement or simply share the value."
    },
    authority_building: {
      strategy: "Authority Building (Promotional) - Showcase expertise while subtly highlighting services",
      post_type: "Expert insight with subtle service positioning",
      content_rules: "- Share professional insights or case studies\n- Demonstrate expertise and unique approach\n- Mention how you help clients (subtly)\n- Position yourself as the knowledgeable solution\n- Balance educational content with credibility building",
      authenticity_note: "Sound like a confident professional who knows their field inside and out",
      cta_guidelines: "Subtle calls-to-action focused on consultation, advice, or learning more. Examples: 'Want to know how this applies to your situation?' or 'Happy to share more insights'"
    },
    direct_sales: {
      strategy: "Direct Sales (Advertising) - Clear calls-to-action to drive immediate business results",
      post_type: "Promotional content with clear value proposition",
      content_rules: "- Clearly state services, offers, or availability\n- Include specific benefits and outcomes\n- Create urgency or highlight limited availability\n- Address customer pain points directly\n- Be direct about what you're offering and why they should choose you",
      authenticity_note: "Sound confident and direct while still being personable and trustworthy",
      cta_guidelines: "Clear, direct calls-to-action. Examples: 'Book your appointment today', 'Call now for a free quote', 'Limited spaces available - message us to secure yours'"
    }
  };

  return guidelines[postType as keyof typeof guidelines] || guidelines.value_first;
}
