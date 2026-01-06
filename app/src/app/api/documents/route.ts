import "@/lib/add-proxy";
import { NextResponse } from "next/server";
import { tokensToCost } from "@/lib/tokens";
import { getModelById, ModelEntry } from "@/lib/models";
import { formatLogDetails, logger } from "@/lib/logger";
import { persistDocumentMetadata, storeDocument } from "@/lib/document-storage";
import { estimateTokensForModel } from "@/lib/token-estimation";

export const runtime = "nodejs";

type UploadPayload = {
  targetLanguage: "en" | "zh";
  modelId: ModelEntry["id"];
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a TXT file." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isText = file.type === "text/plain" || lowerName.endsWith(".txt");

    if (!isText) {
      return NextResponse.json({ error: "Only TXT uploads are supported." }, { status: 400 });
    }

    const targetLanguage = (formData.get("targetLanguage") as UploadPayload["targetLanguage"]) ?? "en";
    const modelId = (formData.get("modelId") as UploadPayload["modelId"]) ?? "gemini-2.5-flash";
    const model = getModelById(modelId);

    if (!model) {
      return NextResponse.json({ error: "Unknown model selected." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = buffer.toString("utf-8");
    const pages = Math.max(1, Math.ceil(text.length / 2000));

    const estimatedTokens = await estimateTokensForModel(model, text);
    // logger.info('Estimated tokens for uploaded document: ' + estimatedTokens);
    const estimatedInputCost = tokensToCost(estimatedTokens, model.inputPricePerMillion);
    const estimatedOutputCost = tokensToCost(estimatedTokens, model.outputPricePerMillion);

    const stored = await storeDocument(buffer, file.name, file.type || "text/plain");
    await persistDocumentMetadata({
      documentId: stored.id,
      filePath: stored.path,
      mimeType: stored.mimeType,
      extension: stored.extension,
      targetLanguage,
      modelId,
      estimatedTokens,
      estimatedCost: estimatedInputCost + estimatedOutputCost,
      pages,
    });

    logger.info(
      {
        documentId: stored.id,
        modelId,
        targetLanguage,
        pages,
        estimatedTokens,
        estimatedCost: estimatedInputCost + estimatedOutputCost,
        details: formatLogDetails({
          documentId: stored.id,
          modelId,
          targetLanguage,
          pages,
          estimatedTokens,
          estimatedCost: estimatedInputCost + estimatedOutputCost,
        }),
      },
      "document uploaded for translation"
    );

    return NextResponse.json({
      documentId: stored.id,
      name: stored.name,
      size: stored.size,
      pages,
      estimatedTokens,
      estimatedCost: estimatedInputCost + estimatedOutputCost,
      targetLanguage,
      model: {
        id: model.id,
        label: model.label,
        provider: model.provider,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
        description: model.description,
      },
    });
  } catch (error) {
    logger.error({ error }, "failed to process document upload");
    return NextResponse.json(
      { error: "Unable to process the TXT file. Please try again with valid text content." },
      { status: 500 }
    );
  }
}
