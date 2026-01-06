import "@/lib/add-proxy";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { estimateTokensForModel } from "@/lib/token-estimation";
import { formatLogDetails, logger } from "@/lib/logger";
import { readDocumentMetadata } from "@/lib/document-storage";
import { getModelById, ModelEntry } from "@/lib/models";
import { tokensToCost } from "@/lib/tokens";

export const runtime = "nodejs";

type EstimateRequestBody = {
  documentId: string;
  modelId: ModelEntry["id"];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EstimateRequestBody;
    const { documentId, modelId } = body;

    if (!documentId || !modelId) {
      return NextResponse.json(
        { error: "Missing document or model selection." },
        { status: 400 }
      );
    }

    const metadata = await readDocumentMetadata(documentId);
    if (!metadata?.filePath) {
      return NextResponse.json(
        { error: "Document metadata missing." },
        { status: 404 }
      );
    }

    const model = getModelById(modelId);
    if (!model) {
      return NextResponse.json({ error: "Unknown model selected." }, { status: 400 });
    }

    const buffer = await readFile(metadata.filePath);
    const text = buffer.toString("utf-8");
    const estimatedTokens = await estimateTokensForModel(model, text);
    const estimatedInputCost = tokensToCost(estimatedTokens, model.inputPricePerMillion);
    const estimatedOutputCost = tokensToCost(estimatedTokens, model.outputPricePerMillion);
    const estimatedCost = Number((estimatedInputCost + estimatedOutputCost).toFixed(6));

    logger.info(
      {
        documentId,
        modelId,
        estimatedTokens,
        estimatedCost,
        details: formatLogDetails({
          documentId,
          modelId,
          estimatedTokens,
          estimatedCost,
        }),
      },
      "re-estimated tokens for uploaded document"
    );

    return NextResponse.json({
      estimatedTokens,
      estimatedCost,
      model: {
        id: model.id,
        label: model.label,
        provider: model.provider,
        description: model.description,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
      },
    });
  } catch (error) {
    logger.error({ error }, "failed to re-estimate document tokens");
    return NextResponse.json(
      { error: "Unable to re-estimate tokens for this document." },
      { status: 500 }
    );
  }
}
