// Types for SSE events
export type TodoChangeEvent = {
  type: "created" | "updated" | "deleted";
  todoId: string;
  data?: {
    id: string;
    title?: string;
    completed?: boolean;
  };
  timestamp: number;
};

// Store active SSE connections (in-memory for demo purposes)
// In production, use Redis pub/sub or similar
type SSEController = {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
};

export const activeConnections = new Map<string, SSEController>();

// Helper to broadcast to all connected clients
export function broadcastTodoChange(event: TodoChangeEvent) {
  const message = `event: todo-change\ndata: ${JSON.stringify(event)}\n\n`;

  for (const [connectionId, { controller, encoder }] of activeConnections) {
    try {
      controller.enqueue(encoder.encode(message));
    } catch (error) {
      // Connection might be closed, remove it
      activeConnections.delete(connectionId);
    }
  }
}
