export type StreamSummary = {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  pages: number;
  model: string;
  targetLanguage: "en" | "zh";
};
