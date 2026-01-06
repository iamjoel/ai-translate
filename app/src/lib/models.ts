export type LanguageOption = "en" | "zh";

export type ModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-5"
  | "claude-opus-4-5"
  | "gemini-2.5-flash"
  | "gemini-3-flash"
  | "gemini-3-pro";

export interface ModelEntry {
  id: ModelId;
  label: string;
  provider: string;
  providerType: "anthropic" | "google";
  description: string;
  contextWindow?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  aiModelId: string;
}

export const MODEL_CATALOG: ModelEntry[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    description:
      "Low-latency translator tuned for real-time workflows; retains safety guardrails while staying economical.",
    contextWindow: "Up to 200K tokens (Haiku tier)",
    inputPricePerMillion: 1,
    outputPricePerMillion: 5,
    providerType: "anthropic",
    aiModelId: "claude-haiku-4-5",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description:
      "High-capacity model with a 1M-token context window when run via the API; best for large, nuanced docs.",
    contextWindow: "Up to 200K tokens in default tier (1M for API beta)",
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
    providerType: "anthropic",
    aiModelId: "claude-sonnet-4-5",
  },
  {
    id: "claude-opus-4-5",
    label: "Claude Opus 4.5",
    provider: "Anthropic",
    description:
      "Top-tier reasoning model; designed for agent orchestration where fidelity and context matter most.",
    contextWindow: "Up to 1M tokens",
    inputPricePerMillion: 5,
    outputPricePerMillion: 25,
    providerType: "anthropic",
    aiModelId: "claude-opus-4-5",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    description:
      "Hybrid reasoning model with a 1M-token context window, affordable for document translation and analysis.",
    contextWindow: "1M tokens",
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
    providerType: "google",
    aiModelId: "gemini-2.5-flash",
  },
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash Preview",
    provider: "Google",
    description:
      "Frontier-level reasoning tuned for speed, with token costs optimized for high-frequency translation streams.",
    contextWindow: "Preview (1M+ tokens)",
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 3,
    providerType: "google",
    aiModelId: "gemini-3-flash",
  },
  {
    id: "gemini-3-pro",
    label: "Gemini 3 Pro Preview",
    provider: "Google",
    description:
      "High-performance reasoning that trades higher cost for the most accurate, pro-level responses.",
    contextWindow: "Preview (1M+ tokens)",
    inputPricePerMillion: 2,
    outputPricePerMillion: 12,
    providerType: "google",
    aiModelId: "gemini-3-pro",
  },
];

const MODEL_LOOKUP: Record<ModelId, ModelEntry> = Object.fromEntries(
  MODEL_CATALOG.map((entry) => [entry.id, entry])
) as Record<ModelId, ModelEntry>;

export function getModelById(id: ModelId) {
  return MODEL_LOOKUP[id];
}
