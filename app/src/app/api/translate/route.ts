import "@/lib/add-proxy";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
// import { tokensToCost } from "@/lib/tokens";
import { getModelById } from "@/lib/models";
import { readDocumentMetadata } from "@/lib/document-storage";
// import { formatLogDetails, logger } from "@/lib/logger";
// import { StreamSummary } from "@/lib/stream-summary";

type TranslateRequestBody = {
  documentId: string;
  modelId: string;
  targetLanguage: "en" | "zh";
};

function languageLabel(code: "en" | "zh") {
  return code === "zh" ? "Simplified Chinese" : "English";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TranslateRequestBody;
    const { documentId, modelId, targetLanguage } = body;

    if (!documentId || !modelId) {
      return NextResponse.json({ error: "Missing document or model selection." }, { status: 400 });
    }

    const model = getModelById(modelId);

    if (!model) {
      return NextResponse.json({ error: "Unknown model selected." }, { status: 400 });
    }

    const metadata = await readDocumentMetadata(documentId);

    if (!metadata?.filePath) {
      return NextResponse.json({ error: "Document metadata missing." }, { status: 404 });
    }

    const buffer = await readFile(metadata.filePath);
    const sourceText = buffer.toString("utf-8");
    console.log('source loaded')
    // console.log('sourceText', sourceText);
    const pages = metadata.pages ?? Math.max(1, Math.ceil(sourceText.length / 2000));
    const startTime = Date.now();
    const textChunks: string[] = [];

    const provider =
      model.providerType === "anthropic"
        ? anthropic(model.aiModelId)
        : google(model.aiModelId);

    console.log(modelId)
    const result = streamText({
      model: provider,
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Preserve technical accuracy, attend to idioms, and keep formatting aligned with the provided text.",
        },
        {
          role: "user",
          content: `Translate the following document into ${languageLabel(targetLanguage)}. Keep the tone neutral and describe cultural notes only when helpful:\n\n${sourceText}`,
        },
      ],
      temperature: 0.1,
      abortSignal: req.signal,

    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            time: (Date.now() - startTime) / 1000,
            totalTokens: part.totalUsage.totalTokens,
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
            reasoningTokens: part.totalUsage.reasoningTokens,
            urlTokens: (part.totalUsage.totalTokens ?? 0) - (part.totalUsage.inputTokens ?? 0) - (part.totalUsage.outputTokens ?? 0) - (part.totalUsage.reasoningTokens ?? 0),
          };
        }
      },
    });
  } catch (error) {
    logger.error({ error }, "translation failed");
    const message = (error as Error).message ?? "Unable to translate document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
