
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroq(messages: { role: string; content: string }[], model = "llama-3.3-70b-versatile") {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}