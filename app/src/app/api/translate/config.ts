export const translatePrompt = {
  system:
    "You are a professional translator. Preserve technical accuracy, attend to idioms, and keep formatting aligned with the provided text.",
  buildUserPrompt(languageLabel: string, text: string) {
    return `Translate the following document into ${languageLabel}. Keep the tone neutral and describe cultural notes only when helpful:\n\n${text}`;
  },
};
