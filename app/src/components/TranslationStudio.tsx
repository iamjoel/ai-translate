"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { formatTokens } from "@/lib/tokens";
import { ModelEntry, MODEL_CATALOG } from "@/lib/models";

type UploadResponse = {
  documentId: string;
  name: string;
  size: number;
  pages: number;
  estimatedTokens: number;
  estimatedCost: number;
  targetLanguage: "en" | "zh";
  model: Pick<ModelEntry, "id" | "label" | "provider" | "description" | "inputPricePerMillion" | "outputPricePerMillion">;
  mimeType: string | null;
  extension: string;
};

type StreamSummary = {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  pages: number;
  model: string;
  targetLanguage: "en" | "zh";
};

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (Simplified Chinese)" },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

export default function TranslationStudio() {
  const [targetLanguage, setTargetLanguage] = useState<"en" | "zh">("en");
  const [selectedModelId, setSelectedModelId] = useState<ModelEntry["id"]>("claude-haiku-4-5");
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentMeta, setDocumentMeta] = useState<UploadResponse | null>(null);
  const [translationText, setTranslationText] = useState("");
  const [summary, setSummary] = useState<StreamSummary | null>(null);
  const translationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (translationRef.current) {
      translationRef.current.scrollTo({ top: translationRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [translationText]);

  const selectedModel = useMemo(
    () => MODEL_CATALOG.find((model) => model.id === selectedModelId)!,
    [selectedModelId]
  );

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isTxt = file.type === "text/plain" || lowerName.endsWith(".txt");

    if (!isTxt) {
      setError("Only TXT files are supported right now.");
      return;
    }

    setDocumentMeta(null);
    setTranslationText("");
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetLanguage", targetLanguage);
      formData.append("modelId", selectedModelId);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Upload failed.");
      }

      const meta = (await response.json()) as UploadResponse;
      setDocumentMeta(meta);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      // cleaned state
    }
  };

  const handleTranslate = async () => {
    if (!documentMeta) {
      setError("Please upload a TXT file before starting translation.");
      return;
    }

    setError(null);
    setTranslationText("");
    setSummary(null);
    setTranslating(true);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: documentMeta.documentId,
          targetLanguage,
          modelId: selectedModelId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Translation failed.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream not available.");
      }

      const decoder = new TextDecoder();
      const parser = createParser((event) => {
        if (event.type !== "event") {
          return;
        }

        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "translation") {
            setTranslationText((prev) => prev + payload.chunk);
          } else if (payload?.type === "summary") {
            setSummary(payload.summary as StreamSummary);
          }
        } catch {
          // ignore malformed events
        }
      });

      let chunk;
      while (!(chunk = await reader.read()).done) {
        parser.feed(decoder.decode(chunk.value, { stream: true }));
      }
    } catch (translateError) {
      setError((translateError as Error).message);
    } finally {
      setTranslating(false);
    }
  };

  const handleDownload = async () => {
    if (!translationText) {
      return;
    }

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pageSize = { width: 612, height: 792 };
    let page = doc.addPage(pageSize);
    const margin = 48;
    const lineHeight = 18;
    let cursorY = pageSize.height - margin;
    const textLines = translationText.split("\n");

    const drawLine = (line: string) => {
      if (cursorY < margin) {
        page = doc.addPage(pageSize);
        cursorY = pageSize.height - margin;
      }
      page.drawText(line, {
        x: margin,
        y: cursorY,
        size: 12,
        font,
        maxWidth: pageSize.width - margin * 2,
      });
      cursorY -= lineHeight;
    };

    textLines.forEach((line) => {
      if (!line.trim()) {
        cursorY -= lineHeight;
        return;
      }

      const words = line.split(" ");
      let currentLine = "";
      words.forEach((word) => {
        const trial = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(trial, 12) > pageSize.width - margin * 2) {
          drawLine(currentLine);
          currentLine = word;
        } else {
          currentLine = trial;
        }
      });

      if (currentLine) {
        drawLine(currentLine);
      }
    });

    const pdfBytes = await doc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentMeta?.name?.replace(/\.[^.]+$/, "") ?? "translation"}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const statusMessage = translationText
    ? translating
      ? "Streaming translation..."
      : "Translation ready. Review the stream below."
          : "Upload a TXT file to preview token estimates.";

  const estimatedCostDisplay = documentMeta
    ? currencyFormatter.format(documentMeta.estimatedCost)
    : null;

  return (
    <div className="space-y-10">
      <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-400">
              Document Translation
            </p>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
              TXT → {targetLanguage === "zh" ? "中文" : "English"}
            </h2>
          </div>
          <div className="flex gap-2">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setTargetLanguage(option.code)}
                className={`rounded-full border px-4 py-1 text-sm font-semibold transition ${
                  targetLanguage === option.code
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            Model
            <select
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value as ModelEntry["id"])}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {MODEL_CATALOG.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} • {model.provider}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
              {selectedModel.description}
            </p>
          </label>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Pricing
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Input tokens:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currencyFormatter.format(selectedModel.inputPricePerMillion)} / 1M
                </span>
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Output tokens:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currencyFormatter.format(selectedModel.outputPricePerMillion)} / 1M
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-700">
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300">
            Upload TXT
          </label>
          <p className="text-xs text-slate-500">
            Each `.txt` should stay within ~30k characters for the demo to keep token estimates sane.
          </p>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileUpload}
            className="mt-3 w-full rounded-3xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 outline-none transition hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          />
        </div>

        {documentMeta && (
          <div className="mt-6 grid gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs text-slate-500">Document</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {documentMeta.name} • {documentMeta.pages} pages
            </p>
            <p className="text-sm text-slate-500">File type: Plain text (.txt)</p>
            <p className="text-sm text-slate-500">Estimated tokens: {formatTokens(documentMeta.estimatedTokens)}</p>
            <p className="text-sm text-slate-500">Estimated cost: {estimatedCostDisplay}</p>
          </div>
        )}
      </section>

      <section className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              Streaming translation
            </p>
            <p className="text-sm text-slate-500">{statusMessage}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!documentMeta || translating || !documentMeta.documentId}
              onClick={handleTranslate}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {translating ? "Translating…" : "Confirm translation"}
            </button>
            <button
              type="button"
              disabled={!translationText || translating}
              onClick={handleDownload}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div
          ref={translationRef}
          className="mt-5 min-h-[220px] rounded-3xl border border-slate-200 bg-slate-50/80 p-5 text-sm leading-relaxed text-slate-900 shadow-inner dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
        >
          {translationText ? (
            <div className="whitespace-pre-line">{translationText}</div>
          ) : (
            <p className="text-xs text-slate-500">No translation streamed yet.</p>
          )}
        </div>

        {summary && (
          <div className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.45em] text-slate-400">
              Final metrics
            </p>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  Input tokens
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatTokens(summary.inputTokens)}</p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  Output tokens
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatTokens(summary.outputTokens)}</p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  Duration
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {(summary.durationMs / 1000).toFixed(1)}s
                </p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">
                  Total cost
                </p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {currencyFormatter.format(summary.cost)}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-3xl border border-red-300 bg-red-50/70 p-4 text-sm text-red-700 shadow-sm dark:border-red-700/90 dark:bg-red-900/60 dark:text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
