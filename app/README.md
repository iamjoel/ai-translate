# AI Translate

This workspace hosts a Next.js 16.1 + Tailwind 4 scaffold that pairs the Vercel AI SDK (v6.x) with Claude/Gemini price estimates and `pino` logging so you can translate TXT files and inspect every token.

## Getting Started

From the `app/` directory:

```bash
pnpm install
pnpm dev
```

`pnpm install` prepares the pnpm lockfile and downloads the Next.js + tooling dependencies; `pnpm dev` starts the App Router server on http://localhost:3000.

## Translation workflow

1. **Upload** a plain-text file (`.txt`, recommended ≤30k characters). You can choose the target language (English or 中文) and the model (Claude Haiku 4.5, Sonnet 4.5, Opus 4.5, Gemini 2.5 Flash, Gemini 3 Flash, or Gemini 3 Pro).
2. The server reads the text, calls Anthropic’s `countTokens` when a Claude model is selected, and reports the estimated input/output cost (output tokens assumed equal to input).
3. After reviewing the preview, confirm translation. The `/api/translate` endpoint calls the backend OpenAI model, streams translated text via SSE, and logs duration/tokens/cost to `logs/app.log`.
4. When the stream finishes, a summary card surfaces actual input/output tokens, duration, and cost; download the result as a PDF by clicking **Download PDF**.

## Environment

| Variable | Purpose | Required |
| --- | --- | --- |
| `OPENAI_API_KEY` | Used by `/api/translate` to call OpenAI (default `gpt-4o-mini`). | ✅ |
| `TRANSLATION_MODEL` | Optional override of the OpenAI model name (e.g., `gpt-4-turbo-preview`). | ❌ |
| `LOG_LEVEL` | Controls `pino` verbosity (`info` by default). | ❌ |
| `LOG_FILE_PATH` | Output file for `pino` JSON logs (default `./logs/app.log`). | ❌ |
| `ANTHROPIC_API_KEY` | Required for Anthropic-based Claude models (`claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-5`). | ✅ |
| `GOOGLE_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` | Needed for Google Gemini models; set whichever credential type the provider integration requires. | ✅ |
| `GEMINI_API_KEY` | Required when counting tokens with `@google/genai` for Gemini models in the upload preview. | ✅ |

Persist these in `.env.local` or the environment before running `pnpm dev`.

## Pricing reference

Costs mirror the vendors’ published per‑million token rates so you can compare trade offs before translating.

- **Claude** (Anthropic) – Haiku 4.5: $1 input / $5 output per million tokens; Sonnet 4.5: $3 input / $15 output; Opus 4.5: $5 input / $25 output. [Source](https://platform.claude.com/docs/en/about-claude/pricing)
- **Gemini** (Google) – 2.5 Flash: $0.30 input / $2.50 output per million tokens; 3 Flash Preview: $0.50 input / $3 output; 3 Pro Preview: $2 input / $12 output. [Source](https://ai.google.dev/gemini-api/docs/pricing)

## Features

- **Next.js 16.1 + Tailwind 4 UI** – the hero section leads straight into the translation studio with live streaming feedback.
- **File+token pipeline** – `/api/documents` reads `.txt` payloads, estimates tokens/cost with `src/lib/tokens.ts`, and bounds the result in the UI.
- **Streaming translation** – `/api/translate` runs the OpenAI translation call, streams text over SSE, and logs cost/time with `pino` (`src/lib/logger.ts`).
- **PDF download** – the UI uses `pdf-lib` to convert translation output back to a downloadable PDF.

## Development notes

- Translation summaries show input/output costs, duration, and token counts so you can audit what hit the model.
- Backend logs live in `logs/app.log` (configurable via `LOG_FILE_PATH`); pretty-printing is enabled when `NODE_ENV !== "production"`.
