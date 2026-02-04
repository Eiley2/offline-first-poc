import { createFileRoute, useRouter } from "@tanstack/react-router";
import { dexieDb } from "@/lib/dexie";
import {
  getTodosFromServer,
  insertTodoToServer,
  updateTodoCompleted,
  updateTodoCompletedOnServer,
} from "@/db/query";
import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { ulid } from "ulid";
import { pendingChanges } from "@/lib/pending-changes";
import { useTodoPolling } from "@/hooks/useTodoPolling";

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

export const Route = createFileRoute("/demo/approvals")({
  component: ApprovalsPage,
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
          } catch (error) {
            console.error("Failed to create todo on server:", error);
          }
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingChanges.size);
  const [lastSyncResult, setLastSyncResult] = useState<
    "success" | "failed" | null
  >(null);

  // Polling for real-time updates (checks every 5 seconds)
  useTodoPolling({
    enabled: isOnline,
    interval: 500, // Check every 5 seconds
    onTodoChange: useCallback(() => {
      console.log("[Polling] Change detected, refreshing data...");
      router.invalidate();
    }, [router]),
  });

  // Manual sync function
  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setLastSyncResult(null);
    console.log("🔄 Manual sync triggered...");

    try {
      // Check if server is reachable first
      const { success } = await syncWithServer();

      if (success) {
        // Server is reachable, invalidate to trigger full sync
        await router.invalidate();
        setPendingCount(pendingChanges.size);
        setIsOnline(true);
        setLastSyncResult("success");
        console.log("✅ Manual sync completed");
      } else {
        // Server not reachable
        setIsOnline(false);
        setLastSyncResult("failed");
        console.log("❌ Server not reachable");
      }
    } catch (error) {
      console.error("❌ Manual sync failed:", error);
      setLastSyncResult("failed");
    } finally {
      setIsSyncing(false);
    }
  }, [router, isSyncing]);

  // Update pending count when items change
  useEffect(() => {
    setPendingCount(pendingChanges.size);
  }, [items]);

  // Check server connectivity on mount
  useEffect(() => {
    const checkConnectivity = async () => {
      const { success } = await syncWithServer();
      setIsOnline(success);
    };
    checkConnectivity();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      console.log("🌐 Online event triggered!");
      // Verify actual connectivity
      await handleManualSync();
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
  }, [handleManualSync]);

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
      setPendingCount(pendingChanges.size);
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

  const handleReject = async (id: string) => {
    console.log(`[handleReject] Starting rejection for ${id}`);
    try {
      // Track as pending change (will be synced on next sync)
      pendingChanges.set(id, { completed: false, timestamp: Date.now() });
      setPendingCount(pendingChanges.size);
      console.log(`[handleReject] Pending changes: ${pendingChanges.size}`);

      await updateTodoCompleted(id, false);
      console.log(
        `[handleReject] updateTodoCompleted finished, invalidating...`
      );

      await router.invalidate();
      console.log(`[handleReject] ✅ Rejection complete`);
    } catch (error) {
      console.error("❌ Error rejecting item:", error);
      alert(`Error al rechazar: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este elemento?")) return;

    try {
      await dexieDb.todos.delete(id);
      router.invalidate();
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const pendingItems = items.filter((item) => !item.completed);
  const approvedItems = items.filter((item) => item.completed);

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Aprobaciones</h1>
          <div className="flex items-center gap-3">
            {/* Sync button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`px-3 py-1.5 text-sm font-medium rounded-full flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                lastSyncResult === "success"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : lastSyncResult === "failed"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
              title="Sincronizar con servidor"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing
                ? "Sincronizando..."
                : lastSyncResult === "success"
                  ? "Sincronizado"
                  : lastSyncResult === "failed"
                    ? "Sin conexión"
                    : "Sincronizar"}
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>

            {isOnline ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1.5">
                <Wifi className="w-4 h-4" />
                Conectado
              </span>
            ) : (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full flex items-center gap-1.5">
                <WifiOff className="w-4 h-4" />
                Sin conexión
              </span>
            )}
          </div>
        </div>
        <p className="text-gray-600">
          Gestiona las aprobaciones de solicitudes. Puedes aprobar o rechazar
          elementos incluso sin conexión.
        </p>
        {!isOnline && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800 flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>
                Trabajando sin conexión. Tus aprobaciones se sincronizarán
                automáticamente al reconectar.
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Agregar nueva solicitud..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newItemTitle.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Agregando..." : "Agregar"}
          </button>
        </div>
        {!isOnline && (
          <p className="text-sm text-orange-600 mt-2 flex items-center gap-1.5">
            <WifiOff className="w-4 h-4" />
            Sin conexión: La solicitud se sincronizará automáticamente cuando
            vuelva la conexión
          </p>
        )}
      </form>

      {/* Pending Items */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-600" />
          Pendientes de Aprobación ({pendingItems.length})
        </h2>
        <div className="space-y-3">
          {pendingItems.length === 0 ? (
            <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-500">No hay elementos pendientes</p>
            </div>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Creado:{" "}
                      {(item.createdAt ?? new Date()).toLocaleDateString(
                        "es-ES",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Approved Items */}
      {approvedItems.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Aprobados ({approvedItems.length})
          </h2>
          <div className="space-y-3">
            {approvedItems.map((item) => (
              <div
                key={item.id}
                className="bg-green-50 border border-green-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium">{item.title}</p>
                    <p className="text-sm text-gray-600 mt-1">Aprobado</p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Total: <strong className="text-gray-900">{items.length}</strong>
            </span>
            <span className="text-gray-600">
              Pendientes:{" "}
              <strong className="text-gray-900">{pendingItems.length}</strong>
            </span>
            <span className="text-gray-600">
              Aprobados:{" "}
              <strong className="text-gray-900">{approvedItems.length}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
