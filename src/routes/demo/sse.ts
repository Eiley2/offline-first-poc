import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { activeConnections, type TodoChangeEvent } from "@/lib/sse-broadcast";

export type { TodoChangeEvent };

// SSE stream for todo changes
export const sseStream = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const connectionId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper function to send SSE messages
      const sendEvent = (data: any, event?: string, id?: string) => {
        let message = "";

        if (id) {
          message += `id: ${id}\n`;
        }

        if (event) {
          message += `event: ${event}\n`;
        }

        message += `data: ${JSON.stringify(data)}\n\n`;

        controller.enqueue(encoder.encode(message));
      };

      // Register this connection
      activeConnections.set(connectionId, { controller, encoder });
      console.log(
        `[SSE] Client connected: ${connectionId}. Total: ${activeConnections.size}`
      );

      // Send initial connection message
      sendEvent(
        {
          message: "Connected to todo changes stream",
          connectionId,
          timestamp: Date.now(),
        },
        "connected"
      );

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          sendEvent({ timestamp: Date.now() }, "heartbeat");
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        activeConnections.delete(connectionId);
        console.log(
          `[SSE] Client disconnected: ${connectionId}. Total: ${activeConnections.size}`
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
