import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { makeRequest } from "./claude";
import { config } from "../config";

const CURRENT_POST_DIR = join(process.cwd(), "current_post");
const RUNWARE_API_URL = "https://api.runware.ai/v1";

export interface CurrentPost {
  platform: string;
  text: string;
  idea: string;
  timestamp: string;
  imagePath: string | null;
}

// Generates a Runware-optimised image prompt from the post text
async function buildImagePrompt(postText: string): Promise<string> {
  const prompt = `You are an AI image prompt engineer. Convert this crypto/AI social media post into a concise image generation prompt for a square graphic suited to X.com.

Post:
${postText}

Rules:
- Describe a compelling visual scene or graphic — NOT text/typography
- Style: sleek dark digital art, neon accents, futuristic tech aesthetic
- Suitable for crypto/AI influencer branding
- Max 60 words
- No quotes, no explanation — just the image prompt

Image prompt:`;

  const response = await makeRequest(prompt, 200);
  return response.trim().replace(/^["']|["']$/g, "");
}

// Calls Runware.ai API and returns the image URL
async function callRunwareAPI(imagePrompt: string): Promise<string> {
  const apiKey = config.image.runwareApiKey;
  if (!apiKey) throw new Error("Runware API key not set in config.image.runwareApiKey");

  const taskUUID = crypto.randomUUID();

  const response = await fetch(RUNWARE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify([{
      taskType: "imageInference",
      taskUUID,
      positivePrompt: imagePrompt,
      width: config.image.width,
      height: config.image.height,
      model: config.image.model,
      numberResults: 1,
      outputFormat: config.image.outputFormat,
    }]),
    // @ts-ignore — Bun-specific TLS option (fixes cert errors on Linux)
    tls: { rejectUnauthorized: false },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Runware API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const result = data?.data?.[0];
  if (!result?.imageURL) throw new Error("Runware returned no imageURL");

  return result.imageURL;
}

// Downloads image from URL and saves to disk
async function downloadImage(url: string, destPath: string): Promise<void> {
  // @ts-ignore — Bun-specific TLS option (fixes cert errors on Linux)
  const response = await fetch(url, { tls: { rejectUnauthorized: false } });
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));
}

// Main export: saves post + optionally generates image, writes to current_post/
export async function saveCurrentPost(
  platform: string,
  postText: string,
  idea: string,
): Promise<CurrentPost> {
  await mkdir(CURRENT_POST_DIR, { recursive: true });

  const roll = Math.random();
  const generateImage = config.image.enabled && roll < config.image.imageChance;

  console.error(`[IMAGE] Roll: ${roll.toFixed(2)} → ${generateImage ? "GENERATING IMAGE" : "NO IMAGE THIS RUN"}`);

  let imagePath: string | null = null;

  if (generateImage) {
    try {
      const imagePrompt = await buildImagePrompt(postText);
      console.error(`[IMAGE] Prompt: ${imagePrompt}`);

      const imageUrl = await callRunwareAPI(imagePrompt);
      const ext = config.image.outputFormat.toLowerCase();
      imagePath = join(CURRENT_POST_DIR, `image.${ext}`);
      await downloadImage(imageUrl, imagePath);
      console.error(`[IMAGE] Saved → ${imagePath}`);
    } catch (err: any) {
      console.error(`[IMAGE] Failed: ${err.message}`);
      imagePath = null;
    }
  }

  const currentPost: CurrentPost = {
    platform,
    text: postText,
    idea,
    timestamp: new Date().toISOString(),
    imagePath,
  };

  await writeFile(
    join(CURRENT_POST_DIR, "post.json"),
    JSON.stringify(currentPost, null, 2),
  );

  return currentPost;
}
