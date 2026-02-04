import { createFileRoute } from "@tanstack/react-router";
import { createSSEStream } from "@/lib/sse";

export const Route = createFileRoute("/api/sse")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        return createSSEStream(request);
      },
    },
  },
});
