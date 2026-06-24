
const GEMINI_IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";
export async function generateImage(prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_IMAGE_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const imagePart = data.candidates
  ?.flatMap((c: any) => c.content?.parts || [])
  ?.find((p: any) => p.inlineData?.data);


  if (!imagePart) throw new Error("No image returned from Gemini");

  // returns base64 data URL — caller decides whether to upload or send inline
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}


