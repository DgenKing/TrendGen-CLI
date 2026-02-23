import { config } from "../config";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function makeRequest(prompt: string, maxTokens?: number): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens ?? config.ai.maxTokens,
    }),
    // @ts-ignore — Bun-specific TLS option (fixes cert errors on Linux)
    tls: { rejectUnauthorized: false },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export const anthropic = null; // Legacy export for compatibility
