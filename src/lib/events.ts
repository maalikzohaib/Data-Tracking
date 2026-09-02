// Real-time Server-Sent Events (SSE) broadcaster & connection manager

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Use globalThis so client registry persists across hot reloads in dev mode
const globalForEvents = globalThis as unknown as {
  sseClients?: Set<SSEClient>;
  heartbeatTimer?: NodeJS.Timeout;
};

const clients = globalForEvents.sseClients ?? new Set<SSEClient>();
globalForEvents.sseClients = clients;

// Send periodic keepalive heartbeat comments to keep connections open
if (!globalForEvents.heartbeatTimer) {
  globalForEvents.heartbeatTimer = setInterval(() => {
    const heartbeatMsg = new TextEncoder().encode(": keepalive\n\n");
    for (const client of clients) {
      try {
        client.controller.enqueue(heartbeatMsg);
      } catch {
        clients.delete(client);
      }
    }
  }, 25000);
}

export function registerClient(id: string, controller: ReadableStreamDefaultController): () => void {
  const client: SSEClient = { id, controller };
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

export function broadcastEvent(type: string, data?: any) {
  const payload = JSON.stringify({
    type,
    data,
    timestamp: Date.now(),
  });
  const message = new TextEncoder().encode(`data: ${payload}\n\n`);

  for (const client of clients) {
    try {
      client.controller.enqueue(message);
    } catch {
      clients.delete(client);
    }
  }
}
