import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { sseStream } from "./sse";

type SSEMessage = {
  message?: string;
  count?: number;
  timestamp: number;
};

type SSEEvent = {
  type: string;
  data: SSEMessage;
  id?: string;
};

export const Route = createFileRoute("/demo/sse-subscribe")({
  component: SSESubscribeComponent,
});

function SSESubscribeComponent() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connect = () => {
    if (eventSource) {
      eventSource.close();
    }

    setStatus("connecting");
    setEvents([]);

    // Use the server function URL
    const es = new EventSource(sseStream.url);

    es.addEventListener("connected", (e) => {
      setStatus("connected");
      setEvents((prev) => [
        ...prev,
        { type: "connected", data: JSON.parse(e.data), id: e.lastEventId },
      ]);
    });

    es.addEventListener("update", (e) => {
      setEvents((prev) => [
        ...prev,
        { type: "update", data: JSON.parse(e.data), id: e.lastEventId },
      ]);
    });

    es.addEventListener("complete", (e) => {
      setEvents((prev) => [
        ...prev,
        { type: "complete", data: JSON.parse(e.data), id: e.lastEventId },
      ]);
      setStatus("disconnected");
      es.close();
    });

    es.onerror = () => {
      setStatus("error");
      es.close();
    };

    setEventSource(es);
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setStatus("disconnected");
    }
  };

  useEffect(() => {
    return () => {
      eventSource?.close();
    };
  }, [eventSource]);

  const statusColors = {
    connecting: "bg-yellow-100 text-yellow-800",
    connected: "bg-green-100 text-green-800",
    disconnected: "bg-gray-100 text-gray-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">SSE Subscriber</h1>

      {/* Status and Controls */}
      <div className="flex items-center gap-4 mb-6">
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status]}`}
        >
          {status}
        </span>

        {status === "disconnected" || status === "error" ? (
          <button
            onClick={connect}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Conectar
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Desconectar
          </button>
        )}
      </div>

      {/* Events List */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">
            Eventos recibidos ({events.length})
          </h2>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-4 text-gray-500 text-center">
              No hay eventos. Haz clic en "Conectar" para iniciar.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {events.map((event, index) => (
                <li key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.type === "connected"
                          ? "bg-green-100 text-green-700"
                          : event.type === "update"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {event.type}
                    </span>
                    {event.id && (
                      <span className="text-xs text-gray-400">
                        ID: {event.id}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(event.data.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-sm text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
