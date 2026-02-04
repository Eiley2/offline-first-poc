import { createFileRoute, useRouter } from "@tanstack/react-router";
import { dexieDb } from "@/lib/dexie";
import {
  getTodosFromServer,
  insertTodoToServer,
  updateTodoCompleted,
  updateTodoCompletedOnServer,
  deleteTodo,
} from "@/db/query";
import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Radio,
} from "lucide-react";
import { ulid } from "ulid";
import { pendingChanges } from "@/lib/pending-changes";
import { sseStream } from "./sse";
import type { TodoChangeEvent } from "@/lib/sse-broadcast";

// Helper to sync with server - returns true if successful
async function syncWithServer(): Promise<{
  success: boolean;
  serverTodos?: Awaited<ReturnType<typeof getTodosFromServer>>;
}> {
  try {
    const serverTodos = await getTodosFromServer();
    return { success: true, serverTodos };
  } catch (error) {
    console.log("[Sync] Server not reachable:", error);
    return { success: false };
  }
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div className="h-7 sm:h-9 w-40 sm:w-48 bg-gray-200 rounded-lg" />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 sm:h-7 w-8 sm:w-20 bg-gray-200 rounded-full" />
            <div className="h-6 sm:h-7 w-8 sm:w-24 bg-gray-200 rounded-full" />
          </div>
        </div>
        <div className="h-4 sm:h-5 w-full sm:w-96 bg-gray-200 rounded mt-2" />
      </div>

      {/* Form Skeleton */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1 h-10 sm:h-12 bg-gray-200 rounded-lg" />
        <div className="h-10 sm:h-12 w-full sm:w-28 bg-gray-200 rounded-lg" />
      </div>

      {/* Section Title Skeleton */}
      <div className="mb-3 sm:mb-4 flex items-center gap-2">
        <div className="h-4 w-4 sm:h-5 sm:w-5 bg-gray-200 rounded" />
        <div className="h-5 sm:h-6 w-32 sm:w-56 bg-gray-200 rounded" />
      </div>

      {/* Items Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1">
                <div className="h-4 sm:h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-3 sm:h-4 w-24 sm:w-40 bg-gray-200 rounded" />
              </div>
              <div className="h-7 sm:h-9 w-7 sm:w-9 bg-gray-200 rounded" />
            </div>
            <div className="h-9 w-full bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/demo/approvals")({
  component: ApprovalsPage,
  pendingComponent: LoadingSkeleton,
  loader: async () => {
    console.log("[Loader] Starting...");

    // Always load from local first (works offline)
    const localTodos = await dexieDb.todos.toArray();
    console.log(`[Loader] Local todos: ${localTodos.length}`);

    // Try to sync with server (works even if navigator.onLine is wrong)
    const { success, serverTodos } = await syncWithServer();

    if (success && serverTodos) {
      console.log(
        `[Loader] Server reachable. Pending changes: ${pendingChanges.size}`
      );

      // Step 1: Push pending local changes to server first
      const successfullySynced: string[] = [];

      for (const [id, change] of pendingChanges.entries()) {
        const serverTodo = serverTodos.find((st) => st.id === id);
        if (serverTodo) {
          try {
            console.log(
              `[Loader] Pushing pending change: ${serverTodo.title} (${id}) → ${change.completed}`
            );
            await updateTodoCompletedOnServer({
              data: { id, completed: change.completed },
            });
            successfullySynced.push(id);
            console.log(
              `[Loader] ✅ Synced pending change: ${serverTodo.title}`
            );
          } catch (error) {
            console.error(
              `[Loader] ❌ Failed to push pending change for ${serverTodo.title}:`,
              error
            );
            // Keep in pendingChanges to retry later
          }
        } else {
          // Item doesn't exist on server yet, might be a new item
          // Check if it exists locally and push it
          const localTodo = localTodos.find((lt) => lt.id === id);
          if (localTodo) {
            try {
              console.log(
                `[Loader] Creating new item on server: ${localTodo.title}`
              );
              await insertTodoToServer({
                data: {
                  id: localTodo.id,
                  title: localTodo.title,
                  completed: change.completed,
                  createdAt: localTodo.createdAt.toISOString(),
                },
              });
              successfullySynced.push(id);
              console.log(`[Loader] ✅ Created and synced: ${localTodo.title}`);
            } catch (error) {
              console.error(
                `[Loader] ❌ Failed to create ${localTodo.title}:`,
                error
              );
              // Keep in pendingChanges to retry later
            }
          }
        }
      }

      // Only clear successfully synced items
      for (const id of successfullySynced) {
        pendingChanges.delete(id);
      }

      console.log(
        `[Loader] Sync complete. Remaining pending: ${pendingChanges.size}`
      );

      // Step 2: Sync server → local (SERVER WINS for items without pending changes)
      // Skip items that were just synced to avoid showing stale server state
      console.log(
        `[Loader] Step 2: Syncing server → local. Pending items: ${Array.from(pendingChanges.keys()).join(", ") || "none"}, Just synced: ${successfullySynced.length}`
      );

      for (const serverTodo of serverTodos) {
        const existsLocally = await dexieDb.todos.get(serverTodo.id);
        const hasPendingChange = pendingChanges.has(serverTodo.id);
        const wasJustSynced = successfullySynced.includes(serverTodo.id);

        if (existsLocally) {
          // NEVER update local with server data if there's a pending local change
          if (hasPendingChange) {
            const pendingValue = pendingChanges.get(serverTodo.id);
            console.log(
              `[Loader] 🔒 Skipping ${serverTodo.title} - pending: ${pendingValue?.completed}, server: ${serverTodo.completed}, local: ${existsLocally.completed}`
            );
            continue;
          }

          // Skip items that were just synced - trust local state
          if (wasJustSynced) {
            console.log(
              `[Loader] ⏭️ Skipping ${serverTodo.title} - just synced, keeping local state`
            );
            continue;
          }

          // Update local with server data ONLY if no pending local change and wasn't just synced
          if (existsLocally.completed !== serverTodo.completed) {
            console.log(
              `[Loader] 📥 Server → Local: ${serverTodo.title} (${existsLocally.completed} → ${serverTodo.completed})`
            );
            await dexieDb.todos.update(serverTodo.id, {
              completed: serverTodo.completed ?? false,
            });
          }
        } else {
          // Add new server todo to local (only if not pending)
          if (!hasPendingChange) {
            console.log(
              `[Loader] 📥 Adding new from server: ${serverTodo.title}`
            );
            await dexieDb.todos.add({
              id: serverTodo.id,
              title: serverTodo.title,
              completed: serverTodo.completed ?? false,
              createdAt: serverTodo.createdAt ?? new Date(),
            });
          }
        }
      }

      // Step 3: Push new local todos to server (that don't have pending changes tracked)
      const justCreatedOnServer: string[] = [];
      for (const localTodo of localTodos) {
        const existsOnServer = serverTodos.find((st) => st.id === localTodo.id);
        if (!existsOnServer && !pendingChanges.has(localTodo.id)) {
          try {
            console.log(`[Loader] Creating on server: ${localTodo.title}`);
            await insertTodoToServer({
              data: {
                id: localTodo.id,
                title: localTodo.title,
                completed: localTodo.completed ?? false,
                createdAt: localTodo.createdAt.toISOString(),
              },
            });
            justCreatedOnServer.push(localTodo.id);
          } catch (error) {
            console.error("Failed to create todo on server:", error);
          }
        }
      }

      // Step 4: Delete local todos that no longer exist on server (were deleted by another client)
      // Only delete if:
      // - There's no pending change for this item
      // - We didn't just create it on the server in Step 3
      for (const localTodo of localTodos) {
        const existsOnServer = serverTodos.find((st) => st.id === localTodo.id);
        const hasPendingChange = pendingChanges.has(localTodo.id);
        const wasJustCreated = justCreatedOnServer.includes(localTodo.id);

        if (!existsOnServer && !hasPendingChange && !wasJustCreated) {
          console.log(
            `[Loader] 🗑️ Deleting ${localTodo.title} - no longer exists on server`
          );
          await dexieDb.todos.delete(localTodo.id);
        }
      }

      // Return fresh local data after sync
      const updatedLocal = await dexieDb.todos.toArray();
      return updatedLocal.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }

    // Server not reachable - return local data
    console.log(
      `[Loader] Working offline. Pending changes: ${pendingChanges.size}`
    );
    return localTodos.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },
  ssr: false,
});

function ApprovalsPage() {
  const items = Route.useLoaderData();
  const router = useRouter();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check server connectivity on mount
  useEffect(() => {
    const checkConnectivity = async () => {
      const { success } = await syncWithServer();
      setIsOnline(success);
    };
    checkConnectivity();
  }, []);

  // SSE subscription for real-time updates
  useEffect(() => {
    const es = new EventSource(sseStream.url);
    eventSourceRef.current = es;

    es.addEventListener("connected", (e) => {
      console.log("[SSE] Connected:", JSON.parse(e.data));
      setSseConnected(true);
    });

    es.addEventListener("todo-change", async (e) => {
      const event: TodoChangeEvent = JSON.parse(e.data);
      console.log("[SSE] Todo change received:", event);

      // Handle different event types
      if (event.type === "deleted") {
        // Delete locally immediately
        console.log(`[SSE] Deleting todo ${event.todoId} locally`);
        await dexieDb.todos.delete(event.todoId);
        // Also remove from pending changes if exists
        pendingChanges.delete(event.todoId);
      }

      // Refresh data when we receive a change from another client
      router.invalidate();
    });

    es.addEventListener("heartbeat", () => {
      // Keep-alive, no action needed
    });

    es.onerror = () => {
      console.log("[SSE] Connection error");
      setSseConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    };
  }, [router]);

  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Online event triggered!");
      setIsOnline(true);
      router.invalidate();
    };

    const handleOffline = () => {
      console.log("📴 Offline event triggered!");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const id = ulid();
      const createdAt = new Date();

      // Always save to local first
      await dexieDb.todos.add({
        id,
        title: newItemTitle.trim(),
        completed: false,
        createdAt,
      });

      // If online, also save to server
      if (isOnline) {
        try {
          await insertTodoToServer({
            data: {
              id,
              title: newItemTitle.trim(),
              completed: false,
              createdAt: createdAt.toISOString(),
            },
          });
        } catch (error) {
          console.error("Failed to sync to server:", error);
        }
      }

      setNewItemTitle("");
      router.invalidate();
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error al agregar elemento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    console.log(`[handleApprove] Starting approval for ${id}`);
    try {
      // Track as pending change (will be synced on next sync)
      pendingChanges.set(id, { completed: true, timestamp: Date.now() });
      console.log(`[handleApprove] Pending changes: ${pendingChanges.size}`);

      await updateTodoCompleted(id, true);
      console.log(
        `[handleApprove] updateTodoCompleted finished, invalidating...`
      );

      await router.invalidate();
      console.log(`[handleApprove] ✅ Approval complete`);
    } catch (error) {
      console.error("❌ Error approving item:", error);
      alert(`Error al aprobar: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este elemento?")) return;

    console.log(`[handleDelete] Starting deletion for ${id}`);
    try {
      // Remove from pending changes if exists
      pendingChanges.delete(id);

      // Delete locally and try to sync with server
      await deleteTodo(id);
      console.log(`[handleDelete] ✅ Deletion complete`);

      await router.invalidate();
    } catch (error) {
      console.error("❌ Error deleting item:", error);
      alert(`Error al eliminar: ${error}`);
    }
  };

  const pendingItems = items.filter((item) => !item.completed);
  const approvedItems = items.filter((item) => item.completed);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Aprobaciones
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* SSE Status */}
            <span
              className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-full flex items-center gap-1 sm:gap-1.5 ${
                sseConnected
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-500"
              }`}
              title={
                sseConnected
                  ? "Recibiendo actualizaciones en tiempo real"
                  : "Sin conexión en tiempo real"
              }
            >
              <Radio
                className={`w-3 h-3 sm:w-4 sm:h-4 ${sseConnected ? "animate-pulse" : ""}`}
              />
              <span className="hidden xs:inline">
                {sseConnected ? "En vivo" : "Offline"}
              </span>
            </span>

            {isOnline ? (
              <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 text-xs sm:text-sm font-medium rounded-full flex items-center gap-1 sm:gap-1.5">
                <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Conectado</span>
              </span>
            ) : (
              <span className="px-2 sm:px-3 py-1 bg-orange-100 text-orange-700 text-xs sm:text-sm font-medium rounded-full flex items-center gap-1 sm:gap-1.5">
                <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Sin conexión</span>
              </span>
            )}
          </div>
        </div>
        <p className="text-sm sm:text-base text-gray-600">
          Gestiona las aprobaciones de solicitudes. Puedes aprobar o rechazar
          elementos incluso sin conexión.
        </p>
        {!isOnline && (
          <div className="mt-3 p-2 sm:p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs sm:text-sm text-orange-800 flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                Trabajando sin conexión. Tus aprobaciones se sincronizarán
                automáticamente al reconectar.
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleSubmit} className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Agregar nueva solicitud..."
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newItemTitle.trim()}
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {isSubmitting ? "Agregando..." : "Agregar"}
          </button>
        </div>
        {!isOnline && (
          <p className="text-xs sm:text-sm text-orange-600 mt-2 flex items-center gap-1.5">
            <WifiOff className="w-4 h-4 shrink-0" />
            Sin conexión: La solicitud se sincronizará automáticamente cuando
            vuelva la conexión
          </p>
        )}
      </form>

      {/* Pending Items */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
          Pendientes ({pendingItems.length})
        </h2>
        <div className="space-y-3">
          {pendingItems.length === 0 ? (
            <div className="text-center py-6 sm:py-8 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-500 text-sm sm:text-base">
                No hay elementos pendientes
              </p>
            </div>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:border-gray-300 transition-colors"
              >
                {/* Content */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 font-medium break-words">
                      {item.title}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {(item.createdAt ?? new Date()).toLocaleDateString(
                        "es-ES",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleApprove(item.id)}
                  className="w-full px-3 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Aprobar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Approved Items */}
      {approvedItems.length > 0 && (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            Aprobados ({approvedItems.length})
          </h2>
          <div className="space-y-3">
            {approvedItems.map((item) => (
              <div
                key={item.id}
                className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-900 font-medium break-words">
                      {item.title}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      Aprobado
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-gray-600">
              Total: <strong className="text-gray-900">{items.length}</strong>
            </span>
            <span className="text-gray-600">
              Pend:{" "}
              <strong className="text-gray-900">{pendingItems.length}</strong>
            </span>
            <span className="text-gray-600">
              Aprob:{" "}
              <strong className="text-gray-900">{approvedItems.length}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
