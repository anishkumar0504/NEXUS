// lib/openRouterClient.ts
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(
  messages: { role: string; content: string }[],
  model: string = "meta-llama/llama-3.3-70b-instruct",
  retries = 3
): Promise<string> {
  console.log("[openrouter] Key exists:", !!process.env.OPENROUTER_API_KEY);
  console.log("[openrouter] Key length:", process.env.OPENROUTER_API_KEY?.length);
  console.log("[openrouter] Model:", model);

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://nexus-chat.app",
          "X-Title": "Nexus",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      console.log("[openrouter] Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
      }

      if ((response.status === 429 || response.status === 503) && i < retries) {
        const delay = Math.pow(2, i) * 2000;
        console.warn(`[openrouter] ${response.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const err = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${err}`);

    } catch (err: any) {
      console.error("[openrouter] Fetch error:", err.message);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error("OpenRouter unavailable after retries");
}