import { ModelEntry } from "./models";
import { countAnthropicTokens } from "./anthropic";
import { countGoogleTokens } from "./google";
import { translatePrompt } from "../app/api/translate/config";

export async function estimateTokensForModel(model: ModelEntry, text: string) {
  if (model.providerType === "anthropic") {
    const tokens = await countAnthropicTokens(model.aiModelId, text, translatePrompt.system);
    return tokens ?? 0;
  }

  if (model.providerType === "google") {
    const tokens = await countGoogleTokens(model.aiModelId, text);
    return tokens ?? 0;
  }

  return 0;
}
