import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";


const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Use the available free models
const TEXT_MODEL = "gemini-2.5-flash"; // 250K TPM, 5 RPM
const IMAGE_MODEL = "gemini-2.5-flash-image"; // ← correct model string

export async function callGemini(
  contents: { role: string; parts: { text: string }[] }[],
  model: string = TEXT_MODEL,
  retries = 3
): Promise<string> {
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  for (let i = 0; i <= retries; i++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if ((response.status === 429 || response.status === 503) && i < retries) {
      const delay = Math.pow(2, i) * 2000;
      console.warn(`[gemini] ${model} ${response.status}, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  throw new Error(`Gemini ${model} unavailable after retries`);
}

// Helper to convert Groq-style messages to Gemini format
export function toGeminiFormat(
  messages: { role: "system" | "user"; content: string }[]
): { role: string; parts: { text: string }[] }[] {
  const systemParts = messages.filter((m) => m.role === "system");
  const userParts = messages.filter((m) => m.role === "user");

  let systemText = "";
  if (systemParts.length) {
    systemText = `System instructions:\n${systemParts.map((m) => m.content).join("\n")}\n\n`;
  }

  return userParts.map((msg) => ({
    role: "user",
    parts: [{ text: systemText + msg.content }],
  }));
}

// Generate image with Imagen 4


export async function generateImageWithGemini(prompt: string): Promise<string> {
  const url = `${GEMINI_API_URL}/${IMAGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],  // IMAGE-only; add "TEXT" if you want captions too
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image gen error: ${response.status} - ${err}`);
  }

  const data = await response.json();

  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.mimeType?.startsWith("image/")
  );
  if (!imagePart) throw new Error("No image in response");

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const key = `generated/${randomUUID()}.png`;
  return uploadToS3(buffer, key);
}