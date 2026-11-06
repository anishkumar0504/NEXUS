
import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Primary models (verify availability for your API project)
const TEXT_MODEL = "gemini-3.8-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

// Text fallback models
const TEXT_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
];

// Image fallback models
const IMAGE_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
];

const RETRYABLE_STATUS_CODES = [404, 429, 500, 502, 503, 504];

// TEXT GENERATION WITH MODEL FALLBACK
export async function callGemini(
  contents: { role: string; parts: { text: string }[] }[],
  model: string = TEXT_MODEL,
  retries = 3
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const models = [
    ...new Set([
      model,
      ...TEXT_FALLBACK_MODELS.filter((m) => m !== model),
    ]),
  ];

  const failures: string[] = [];

  for (const currentModel of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const url =
          `${GEMINI_API_URL}/${currentModel}:generateContent` +
          `?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
          signal: AbortSignal.timeout(60000),
        });

        if (response.ok) {
          const data = await response.json();

          const text = data.candidates?.[0]?.content?.parts
            ?.map((part: any) => part.text || "")
            .join("");

          if (!text) {
            failures.push(`${currentModel}: Empty response`);
            break;
          }

          console.log(`[gemini] Success using ${currentModel}`);
          return text;
        }

        const errorBody = await response.text();

        console.warn(
          `[gemini] ${currentModel} failed with ${response.status}`
        );

        failures.push(
          `${currentModel}: ${response.status} - ${errorBody}`
        );

        if (!RETRYABLE_STATUS_CODES.includes(response.status)) {
          throw new Error(
            `Gemini API error: ${response.status} - ${errorBody}`
          );
        }

        // Preserve existing exponential retry behavior
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 2000;

          console.warn(
            `[gemini] Retrying ${currentModel} in ${delay}ms`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );

          continue;
        }

        // Current model exhausted; move to next model
        break;
      } catch (error: any) {
        if (error.message?.startsWith("Gemini API error:")) {
          throw error;
        }

        console.error(
          `[gemini] ${currentModel} attempt ${attempt + 1} failed:`,
          error.message
        );

        failures.push(`${currentModel}: ${error.message}`);

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 2000;

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );

          continue;
        }

        break;
      }
    }
  }

  throw new Error(
    `All Gemini text models failed:\n${failures.join("\n")}`
  );
}

// HELPER TO CONVERT GROQ-STYLE MESSAGES TO GEMINI FORMAT
export function toGeminiFormat(
  messages: { role: "system" | "user"; content: string }[]
): { role: string; parts: { text: string }[] }[] {
  const systemParts = messages.filter((m) => m.role === "system");
  const userParts = messages.filter((m) => m.role === "user");

  let systemText = "";

  if (systemParts.length) {
    systemText =
      `System instructions:\n${systemParts.map((m) => m.content).join("\n")}\n\n`;
  }

  return userParts.map((msg) => ({
    role: "user",
    parts: [{ text: systemText + msg.content }],
  }));
}

// IMAGE GENERATION WITH MODEL FALLBACK
export async function generateImageWithGemini(
  prompt: string
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const models = [IMAGE_MODEL, ...IMAGE_FALLBACK_MODELS];
  const failures: string[] = [];

  for (const currentModel of models) {
    try {
      const url =
        `${GEMINI_API_URL}/${currentModel}:generateContent` +
        `?key=${process.env.GEMINI_API_KEY}`;

      console.log(`[gemini-image] Trying ${currentModel}`);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: prompt }] },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        failures.push(
          `${currentModel}: ${response.status} - ${errorBody}`
        );

        if (RETRYABLE_STATUS_CODES.includes(response.status)) {
          console.warn(
            `[gemini-image] ${currentModel} failed: ${response.status}, switching model`
          );
          continue;
        }

        throw new Error(
          `Image gen error: ${response.status} - ${errorBody}`
        );
      }

      const data = await response.json();

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart) {
        failures.push(`${currentModel}: No image in response`);
        continue;
      }

      const buffer = Buffer.from(
        imagePart.inlineData.data,
        "base64"
      );

      const key = `generated/${randomUUID()}.png`;

      console.log(
        `[gemini-image] Success using ${currentModel}`
      );

      return await uploadToS3(buffer, key);
    } catch (error: any) {
      if (error.message?.startsWith("Image gen error:")) {
        throw error;
      }

      console.error(
        `[gemini-image] ${currentModel} failed:`,
        error.message
      );

      failures.push(`${currentModel}: ${error.message}`);
    }
  }

  throw new Error(
    `All Gemini image models failed:\n${failures.join("\n")}`
  );
}
