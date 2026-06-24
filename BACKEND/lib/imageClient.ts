// lib/imageClient.ts (or keep geminiClient.ts if you prefer)
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

export async function generateImage(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  // Returns direct image URL with no watermark, 1024x1024
  return `${POLLINATIONS_URL}/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
}