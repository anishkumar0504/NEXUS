// lib/imageClient.ts
import { randomUUID } from "crypto";
import { uploadToS3 } from "./s3Client.js";

const HF_MODEL = process.env.HF_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell";
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pollinations takes the prompt inside the URL, so it must be short and single-line.
// Also strips "@imagegen"-style mentions that leak in from the chat message.
function cleanPrompt(raw: string, max = 400): string {
  const cleaned = raw
    .replace(/@\w+/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, max);
}

type ImageData = { buffer: Buffer; ext: string };

function extFromType(type: string): string {
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

// ── Hugging Face (Inference Providers router) ─────────────────────────────
// Needs: npm i @huggingface/inference and HF_API_KEY in .env
// (token with Inference Providers permission; routed calls use HF credits).
async function generateWithHF(prompt: string): Promise<ImageData> {
  console.log("[image] Trying Hugging Face...");

  // read at call time so dotenv has already loaded
  const token = process.env.HF_API_KEY;
  if (!token) throw new Error("HF_API_KEY is not set");

  const { InferenceClient } = await import("@huggingface/inference");
  const client = new InferenceClient(token);

  const blob: Blob = (await client.textToImage({
    provider: "auto",
    model: HF_MODEL,
    inputs: prompt,
  } as any)) as any;

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length < 1000) throw new Error("HF returned an empty/invalid image");
  return { buffer, ext: extFromType(blob.type ?? "") };
}

// ── Pollinations ──────────────────────────────────────────────────────────
// Free tier = 1 image / 45s per IP and answers 402 FREE_LIMIT when exceeded.
// Calls are queued one at a time, and the "Retry after Ns" hint is honored.
let pollQueue: Promise<unknown> = Promise.resolve();

function generateWithPollinations(prompt: string): Promise<ImageData> {
  const run = pollQueue.then(() => pollinationsOnce(prompt));
  pollQueue = run.catch(() => {});
  return run;
}

async function pollinationsOnce(prompt: string): Promise<ImageData> {
  console.log("[image] Trying Pollinations...");

  const url =
    `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&seed=${Math.floor(Math.random() * 2_000_000_000)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });

    if (res.status === 402 || res.status === 429) {
      const body = await res.text();
      const m = body.match(/Retry after (\d+)s/i);
      const waitMs = ((m ? parseInt(m[1], 10) : 45) + 1) * 1000;
      if (attempt < 2 && waitMs <= 60_000) {
        console.warn(`[image] Pollinations rate limited, waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw new Error(`Pollinations ${res.status}: ${body.slice(0, 300)}`);
    }

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Pollinations ${res.status}: ${body}`);
    }

    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Pollinations returned non-image (${type}): ${body}`);
    }

    return { buffer: Buffer.from(await res.arrayBuffer()), ext: extFromType(type) };
  }

  throw new Error("Pollinations rate limited");
}

// ── Public API ────────────────────────────────────────────────────────────
export async function generateImage(rawPrompt: string): Promise<string> {
  const prompt = cleanPrompt(rawPrompt);
  console.log("[image] Starting generation, prompt length:", rawPrompt.length, "->", prompt.length);

  if (!prompt) throw new Error("Image prompt is empty");

  let image: ImageData;
  const errors: string[] = [];

  try {
    image = await generateWithHF(prompt);
    console.log("[image] HF success");
  } catch (hfErr: any) {
    console.warn("[image] HF failed:", hfErr.message);
    errors.push(`HF: ${hfErr.message}`);

    try {
      image = await generateWithPollinations(prompt);
      console.log("[image] Pollinations success");
    } catch (pollErr: any) {
      console.error("[image] Pollinations also failed:", pollErr.message);
      errors.push(`Pollinations: ${pollErr.message}`);
      console.error("[image] All providers failed ->", errors.join(" | "));
      throw new Error("All image generation services failed");
    }
  }

  // Bucket is already named "generated", so no extra folder prefix
  const key = `${randomUUID()}.${image.ext}`;
  return uploadToS3(image.buffer, key);
}