import dotenv from "dotenv";
dotenv.config();
import express, { response } from 'express';
import cors from 'cors';
import  { tavily } from '@tavily/core';
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from './prompt.js';
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodResponseMimeType, zodToJsonSchema } from "zod-to-json-schema"; // or use the built-in helper

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

const app = express();
app.use(express.json());
const port = 3000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log(process.env.GEMINI_API_KEY)
const ResponseSchema = z.object({
  answer: z.string(),
  followUps: z.array(z.string()),
});
type Response = z.infer<typeof ResponseSchema>;

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post("/ask", async(req, res) => {

// step1: to get the search query from the user
const query = req.body.query;

// step2: to check the token or credits of the user and decide whether to allow the search or not


// step3: check if we have web search indexed to the similar query





// step4: web search to gather sources 
const webSearchResponse = await client.search(query,{
searchDepth:"advanced"
}) 
const webSearchResult = webSearchResponse.results;
// step5: to make the 

// step6: hit the llm and stream the response back to the user

const prompt = PROMPT_TEMPLATE
                .replace("{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResult))
                .replace("{USER_QUERY}", query);

const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    systemInstruction: SYSTEM_PROMPT,
  },
});
for await (const chunk of stream) {
  res.write(chunk.text ?? "");
}
res.write("\n<SOURCES>\n")

// step7: also stream the sources back to the user and follow up questions if any
res.write(JSON.stringify(webSearchResult.map(result=>({url:result.url}))));
// webSearchResult.forEach(results=>{
//     res.write(JSON.stringify(results));
// })


res.write("\n</SOURCES>\n")

res.end();

// step8: close

});

app.post("/ask/followup",async(req,res)=>{
    //Step1: to get the existing conversation from the db
    //Step2: send all the history to the llm and get the follow up question
    //Step3: stream the response back to user 
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});


