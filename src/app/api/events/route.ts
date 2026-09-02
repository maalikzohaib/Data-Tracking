import { registerClient } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const clientId = Math.random().toString(36).slice(2);
  let unregister: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      unregister = registerClient(clientId, controller);
      // Send initial connected payload
      const initPayload = JSON.stringify({
        type: "connected",
        clientId,
        timestamp: Date.now(),
      });
      controller.enqueue(new TextEncoder().encode(`data: ${initPayload}\n\n`));
    },
    cancel() {
      if (unregister) {
        unregister();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
