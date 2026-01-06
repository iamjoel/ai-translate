import { ModelEntry } from "./models";
import { countAnthropicTokens } from "./anthropic";
import { countGoogleTokens } from "./google";

const TRANSLATION_SYSTEM_PROMPT =
  "You are a professional translator. Preserve technical accuracy, attend to idioms, and keep formatting aligned with the provided text.";

export async function estimateTokensForModel(model: ModelEntry, text: string) {
  if (model.providerType === "anthropic") {
    const tokens = await countAnthropicTokens(model.aiModelId, text, TRANSLATION_SYSTEM_PROMPT);
    return tokens ?? 0;
  }

  if (model.providerType === "google") {
    const tokens = await countGoogleTokens(model.aiModelId, text);
    return tokens ?? 0;
  }

  return 0;
}
