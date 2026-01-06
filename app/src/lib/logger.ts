import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logFilePath = resolve(process.env.LOG_FILE_PATH ?? "./logs/app.log");

mkdirSync(dirname(logFilePath), { recursive: true });

const fileStream = pino.destination({
  dest: logFilePath,
  sync: false,
});

const prettyStream =
  !isProduction &&
  pino.transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      messageFormat: "{time} {level} {msg}{details}",
      translateTime: false,
    },
  });

const streamTargets: Parameters<typeof pino.multistream>[0] = [
  {
    level: process.env.LOG_LEVEL ?? "info",
    stream: fileStream,
  },
];

if (prettyStream) {
  streamTargets.push({ level: "debug", stream: prettyStream });
}

function formatTimestamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `[${month}-${day} ${hours}:${minutes}]`;
}

export function formatLogDetails(data: Record<string, unknown>) {
  const entries = Object.entries(data)
    .map(([key, value]) =>
      `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`
    )
    .join(" ");

  return entries ? `\n${entries}` : "";
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: formatTimestamp,
    base: null,
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
    },
  },
  pino.multistream(streamTargets)
);
