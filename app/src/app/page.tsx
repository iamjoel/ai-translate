import TranslationStudio from "@/components/TranslationStudio";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 rounded-4xl border border-white/10 bg-white/80 p-8 shadow-2xl shadow-slate-900/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            ai translate
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
            Translation that feels human.
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            This demo wires Next.js 16.1, the Vercel AI SDK 6.x, and `pino` logging so you can iterate on an
            observability-friendly translation assistant without waiting for CI runs.
          </p>
        </section>

        <section className="rounded-4xl border border-slate-200 bg-white/70 p-6 shadow-xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-950/80">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Start translating
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ask a question, paste a paragraph, or drop in a phrase. The AI replies with a contextual, fluent translation
            streamed via the AI SDK.
          </p>
          <div className="mt-6">
            <TranslationStudio />
          </div>
        </section>
      </main>
    </div>
  );
}
