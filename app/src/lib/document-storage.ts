import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export interface StoredDocument {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  path: string;
  extension: string;
  mimeType: string | null;
}

export interface DocumentMetadata {
  documentId: string;
  filePath: string;
  mimeType: string | null;
  extension: string;
  targetLanguage?: string;
  modelId?: string;
  estimatedTokens?: number;
  estimatedCost?: number;
  pages?: number;
}

const UPLOAD_DIR = resolve(process.cwd(), "uploads");

async function ensureUploadDirectory() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function getMetadataPath(documentId: string) {
  return resolve(UPLOAD_DIR, `${documentId}.json`);
}

export async function persistDocumentMetadata(metadata: DocumentMetadata) {
  await ensureUploadDirectory();

  const metaPath = getMetadataPath(metadata.documentId);
  await writeFile(metaPath, JSON.stringify(metadata));
  return metadata;
}

export async function readDocumentMetadata(documentId: string) {
  try {
    const raw = await readFile(getMetadataPath(documentId), { encoding: "utf-8" });
    return JSON.parse(raw) as DocumentMetadata;
  } catch {
    return null;
  }
}

function sanitizeExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }

  return filename.substring(lastDot);
}

export async function storeDocument(buffer: Buffer, filename: string, mimeType: string | null) {
  await ensureUploadDirectory();

  const extension = sanitizeExtension(filename) || ".txt";
  const id = randomUUID();
  const path = resolve(UPLOAD_DIR, `${id}${extension}`);
  await writeFile(path, buffer);

  return {
    id,
    name: filename,
    size: buffer.length,
    path,
    extension,
    mimeType,
    uploadedAt: new Date().toISOString(),
  } satisfies StoredDocument;
}
