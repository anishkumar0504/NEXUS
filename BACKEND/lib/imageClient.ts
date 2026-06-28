// lib/imageClient.ts
import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const HF_TOKEN = process.env.HF_API_KEY;
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

async function generateWithHF(prompt: string): Promise<Buffer> {
  console.log("[image] Trying Hugging Face...");
  const response = await fetch(
    `${HF_API_URL}/black-forest-labs/FLUX.1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF API error: ${response.status} - ${err}`);
  }

  const blob = await response.blob();
  return Buffer.from(await blob.arrayBuffer());
}

async function generateWithPollinations(prompt: string): Promise<Buffer> {
  console.log("[image] Trying Pollinations...");
  const encoded = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_URL}/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pollinations error: ${response.status}`);

  const blob = await response.blob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function generateImage(prompt: string): Promise<string> {
  console.log("[image] Starting generation, prompt length:", prompt.length);

  let buffer: Buffer;

  // Try HF first
  try {
    buffer = await generateWithHF(prompt);
    console.log("[image] HF success");
  } catch (hfErr: any) {
    console.warn("[image] HF failed:", hfErr.message);
    
    // Fallback to Pollinations
    try {
      buffer = await generateWithPollinations(prompt);
      console.log("[image] Pollinations success");
    } catch (pollErr: any) {
      console.error("[image] Pollinations also failed:", pollErr.message);
      throw new Error("All image generation services failed");
    }
  }

  // Upload to S3
  const key = `generated/${randomUUID()}.png`;
  return uploadToS3(buffer, key);
}