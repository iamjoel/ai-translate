import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { estimateTokens, tokensToCost } from "@/lib/tokens";
import { getModelById } from "@/lib/models";
import { readDocumentMetadata } from "@/lib/document-storage";
import { formatLogDetails, logger } from "@/lib/logger";

type TranslateRequestBody = {
  documentId: string;
  modelId: string;
  targetLanguage: "en" | "zh";
};

const CHUNK_SIZE = 600;

function languageLabel(code: "en" | "zh") {
  return code === "zh" ? "Simplified Chinese" : "English";
}

async function translateWithModel(model: ReturnType<typeof getModelById>, text: string, language: "en" | "zh") {
  const provider =
    model.providerType === "anthropic"
      ? anthropic(model.aiModelId)
      : google(model.aiModelId);

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
        content: `Translate the following document into ${languageLabel(language)}. Keep the tone neutral and describe cultural notes only when helpful:\n\n${text}`,
      },
    ],
    temperature: 0.1,
  });

  const rendered = await result.text();
  if (!rendered) {
    throw new Error("The AI model returned no content.");
  }

  return rendered;
}

type TranslationSummary = {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  pages: number;
  model: string;
  targetLanguage: "en" | "zh";
};

function createTranslationStream(translation: string, summary: TranslationSummary) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < translation.length; i += CHUNK_SIZE) {
        const chunk = translation.slice(i, i + CHUNK_SIZE);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "translation", chunk })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "summary", summary })}\n\n`)
      );
      controller.close();
    },
  });
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
    const pages = metadata.pages ?? Math.max(1, Math.ceil(sourceText.length / 2000));

    const startTime = Date.now();

    const translation = await translateWithModel(model, sourceText, targetLanguage);
    const inputTokens = estimateTokens(sourceText);
    const outputTokens = estimateTokens(translation);
    const translationCost =
      tokensToCost(inputTokens, model.inputPricePerMillion) +
      tokensToCost(outputTokens, model.outputPricePerMillion);
    const durationMs = Date.now() - startTime;

    const summary = {
      inputTokens,
      outputTokens,
      cost: Number(translationCost.toFixed(6)),
      durationMs,
      pages,
      model: model.label,
      targetLanguage,
    };

    logger.info(
      {
        documentId,
        modelId,
        ...summary,
        details: formatLogDetails({
          documentId,
          modelId,
          ...summary,
        }),
      },
      "translation completed"
    );

    const stream = createTranslationStream(translation, summary);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error({ error }, "translation failed");
    const message = (error as Error).message ?? "Unable to translate document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
