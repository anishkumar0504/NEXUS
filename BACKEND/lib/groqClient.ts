export async function callGroq(
  messages: { role: string; content: string }[],
  model: string = "llama-3.3-70b-versatile",
  retries = 3
): Promise<string> {
  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  });

  for (let i = 0; i <= retries; i++) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body,
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || "";
    }

    // 503 = over capacity, 429 = rate limit
    if ((response.status === 503 || response.status === 429) && i < retries) {
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.warn(`[groq] ${model} ${response.status}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${err}`);
  }

  throw new Error(`Groq API error: ${model} unavailable after ${retries} retries`);
}