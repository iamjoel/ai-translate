import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getAnthropicClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

export async function countAnthropicTokens(model: string, text: string) {
  const anthropicClient = getAnthropicClient();
  if (!anthropicClient) {
    return null;
  }
  let response;
  try {
    response = await anthropicClient.messages.countTokens({
      model,
      system: "You are a professional translator.",
      messages: [{ role: "user", content: text }],
    });
  } catch (e) {
    console.error("Error counting Anthropic tokens:", e);
  }

  return response?.input_tokens ?? null;
}
