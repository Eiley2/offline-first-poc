// Store active SSE connections
const clients = new Set<ReadableStreamDefaultController>();

// Notify all connected clients
export function notifyTodoChange() {
  const message = `data: ${JSON.stringify({ type: "todo-change", timestamp: Date.now() })}\n\n`;

  console.log(`[SSE] Notifying ${clients.size} clients of todo change`);

  for (const client of clients) {
    try {
      client.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      // Client disconnected, remove it
      console.log("[SSE] Client disconnected, removing from set");
      clients.delete(client);
    }
  }
}

export function createSSEStream(request: Request): Response {
  console.log("[SSE] New client connecting...");

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add this client to the set
      clients.add(controller);
      console.log(`[SSE] Client connected. Total clients: ${clients.size}`);

      // Send initial connection message
      const message = `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(message));

      // Send keepalive every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          const keepalive = `: keepalive\n\n`;
          controller.enqueue(new TextEncoder().encode(keepalive));
        } catch (error) {
          console.log("[SSE] Keepalive failed, client disconnected");
          clearInterval(keepaliveInterval);
          clients.delete(controller);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        console.log("[SSE] Client aborted connection");
        clearInterval(keepaliveInterval);
        clients.delete(controller);
        controller.close();
      });
    },
    cancel() {
      console.log("[SSE] Stream cancelled");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
