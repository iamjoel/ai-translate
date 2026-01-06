import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getGoogleClient() {
  if (aiClient) {
    return aiClient;
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return null;
  }

  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

export async function countGoogleTokens(model: string, text: string) {
  const client = getGoogleClient();
  if (!client) {
    return null;
  }

  const response = await client.models.countTokens({
    model,
    contents: text,
  });

  return response.totalTokens ?? null;
}
