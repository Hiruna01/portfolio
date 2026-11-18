import { z } from "zod";
import { hasCredentials, loadContext, publicError, runAgent, runDemo } from "@/lib/agent";
import { countAttempts, recordAttempt } from "@/lib/store";
import type { ChatEvent } from "@/lib/types";

export const maxDuration = 60;

const MAX_QUESTION_CHARS = 600;
const MAX_HISTORY = 12;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40),
});

export async function POST(request: Request) {
  const context = await loadContext();
  const { settings } = context;
  if (!settings.enabled) {
    return Response.json({ error: "The agent is switched off right now. You can still browse the pages from the menu." }, { status: 503 });
  }

  // Per-visitor limit, stored in the database so it holds across server instances.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const bucket = `chat:${ip}`;
  if ((await countAttempts(bucket, settings.rateLimitWindowMinutes)) >= settings.rateLimitMax) {
    return Response.json({ error: "You've asked a lot of questions. Try again in a few minutes." }, { status: 429 });
  }
  await recordAttempt(bucket);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }
  const history = parsed.data.messages.slice(-MAX_HISTORY);
  // The conversation sent to the model has to open with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  const last = history[history.length - 1];
  if (!last || last.role !== "user") {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }
  if (last.content.length > MAX_QUESTION_CHARS) {
    return Response.json({ error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The visitor closed the page; nothing left to send to.
        }
      };
      try {
        if (hasCredentials()) await runAgent(history, context, send, request.signal);
        else await runDemo(history, context, send);
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("[chat]", err);
          send({ t: "error", message: publicError(err) });
        }
      } finally {
        send({ t: "done" });
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
