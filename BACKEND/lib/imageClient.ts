import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";

const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

export async function generateImage(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  const pollinationsUrl = `${POLLINATIONS_URL}/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

  const response = await fetch(pollinationsUrl);
  if (!response.ok) throw new Error("Failed to fetch image from Pollinations");

  const buffer = Buffer.from(await response.arrayBuffer());
  const key = `generated/${randomUUID()}.png`;

  return uploadToS3(buffer, key);
}