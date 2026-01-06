import "@/lib/add-proxy";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { tokensToCost } from "@/lib/tokens";
import { getModelById } from "@/lib/models";
import { persistTranslatedDocument, readDocumentMetadata } from "@/lib/document-storage";
import { formatLogDetails, logger } from "@/lib/logger";
import { StreamSummary } from "@/lib/stream-summary";
import { estimateTokensForModel } from "@/lib/token-estimation";
import { translatePrompt } from "./config";

export const runtime = "nodejs";

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
      return NextResponse.json(
        { error: "Missing document or model selection." },
        { status: 400 }
      );
    }

    const model = getModelById(modelId);

    if (!model) {
      return NextResponse.json({ error: "Unknown model selected." }, { status: 400 });
    }

    const metadata = await readDocumentMetadata(documentId);

    if (!metadata?.filePath) {
      return NextResponse.json(
        { error: "Document metadata missing." },
        { status: 404 }
      );
    }

    const buffer = await readFile(metadata.filePath);
    const sourceText = buffer.toString("utf-8");
    const pages = metadata.pages ?? Math.max(1, Math.ceil(sourceText.length / 2000));
    const startTime = Date.now();
    const textChunks: string[] = [];

    const provider =
      model.providerType === "anthropic"
        ? anthropic(model.aiModelId)
        : google(model.aiModelId);

    const result = streamText({
      model: provider,
      messages: [
        {
          role: "system",
          content: translatePrompt.system,
        },
        {
          role: "user",
          content: translatePrompt.buildUserPrompt(
            languageLabel(targetLanguage),
            sourceText
          ),
        },
      ],
      temperature: 0.1,
      abortSignal: req.signal,
      onChunk({ chunk }) {
        if (chunk.type === "text" && typeof chunk.text === "string") {
          textChunks.push(chunk.text);
        } else if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
          textChunks.push(chunk.delta);
        }
      },
    });

    const stream = createUIMessageStream({
      async execute({ writer }) {
        await writer.merge(result.toUIMessageStream());
        const translationText = textChunks.join("");

        const safeEstimate = async (text: string) => {
          try {
            return await estimateTokensForModel(model, text);
          } catch (estimateError) {
            logger.debug(
              { error: estimateError, documentId, modelId },
              "token estimation failed"
            );
            return 0;
          }
        };

        const inputTokens = await safeEstimate(sourceText);
        const outputTokens = await safeEstimate(translationText);
        const translationCost =
          tokensToCost(inputTokens, model.inputPricePerMillion) +
          tokensToCost(outputTokens, model.outputPricePerMillion);
        const durationMs = Date.now() - startTime;

        try {
          const baseName =
            metadata.name?.replace(/\.[^.]+$/, "") ?? `translation-${documentId}`;
          const translationName = `${baseName}-${targetLanguage}.txt`;
          const translationBuffer = Buffer.from(translationText, "utf-8");
          await persistTranslatedDocument(
            documentId,
            translationBuffer,
            translationName,
            "text/plain"
          );
        } catch (translationStorageError) {
          logger.error(
            { error: translationStorageError, documentId },
            "failed to persist translated document"
          );
        }

        const summary: StreamSummary = {
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

        await writer.write({
          type: "data-translation-summary",
          data: summary,
        });
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    logger.error({ error }, "translation failed");
    const message = (error as Error).message ?? "Unable to translate document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
