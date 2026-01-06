import "@/lib/add-proxy";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { readDocumentMetadata } from "@/lib/document-storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "Missing document id." }, { status: 400 });
  }

  const metadata = await readDocumentMetadata(documentId);
  const translation = metadata?.translationDocument;

  if (!translation?.path) {
    return NextResponse.json({ error: "Translated document not found." }, { status: 404 });
  }

  try {
    const fileBuffer = await readFile(translation.path);
    const headers = new Headers({
      "Content-Type": translation.mimeType ?? "text/plain",
      "Content-Disposition": `attachment; filename="${translation.name}"`,
    });

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load the translated document." },
      { status: 500 }
    );
  }
}
