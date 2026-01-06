import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { formatLogDetails, logger } from "@/lib/logger";

const CHAT_SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ??
  "You are a precise translator that rewrites user input into fluent English and explains cultural nuances when appropriate.";

type ChatMessagePayload = {
  role?: "user" | "assistant" | "system";
  content?: string;
};

const sanitizeMessages = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const body = payload as { messages?: unknown };
  if (!Array.isArray(body.messages)) {
    return [];
  }

  return body.messages
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const message = entry as ChatMessagePayload;
      const role = message.role ?? "user";
      const content =
        typeof message.content === "string" ? message.content.trim() : "";

      if (!content) {
        return null;
      }

      if (role !== "user" && role !== "assistant" && role !== "system") {
        return null;
      }

      return { role, content };
    })
    .filter((message): message is { role: "user" | "assistant" | "system"; content: string } => Boolean(message));
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const incomingMessages = sanitizeMessages(body);
    const messages = [
      {
        role: "system" as const,
        content: CHAT_SYSTEM_PROMPT,
      },
      ...incomingMessages,
    ];

    logger.info(
      {
        messages: incomingMessages.length,
        details: formatLogDetails({ messages: incomingMessages.length }),
      },
      "chat handler invoked"
    );

    const response = await streamText({
      model: openai("gpt-4o-mini"),
      messages,
    });

    return response.toAIStreamResponse();
  } catch (error) {
    logger.error({ error }, "failed to stream chat response");
    return new Response(JSON.stringify({ error: "Unable to complete this request." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function GET() {
  return new Response(null, { status: 405 });
}
