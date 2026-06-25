// lib/imageClient.ts
import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const HF_TOKEN = process.env.HF_API_KEY;

export async function generateImage(prompt: string): Promise<string> {
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
  const buffer = Buffer.from(await blob.arrayBuffer());
  
  const key = `generated/${randomUUID()}.png`;
  return uploadToS3(buffer, key);
}