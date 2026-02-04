import {
  createFileRoute,
  Link,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  ListTodo,
  Wifi,
  WifiOff,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import {
  getTodosFromServer,
  updateTodoCompletedOnServer,
  insertTodoToServer,
} from "@/db/query";
import { dexieDb } from "@/lib/dexie";

export const Route = createFileRoute("/demo")({
  component: DemoLayout,
});

function DemoLayout() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log("🌐 [Layout] Online detected");
      setIsOnline(true);
      // Note: Sync is handled by individual pages (approvals.tsx)
      // to avoid race conditions
    };

    const handleOffline = () => {
      console.log("📴 [Layout] Offline detected");
      setIsOnline(false);
      setSyncStatus(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;

    console.log("🔄 [Layout] Manual sync triggered...");
    setSyncStatus("Sincronizando...");
    setIsSyncing(true);

    try {
      const localTodos = await dexieDb.todos.toArray();
      const serverTodos = await getTodosFromServer();
      let syncCount = 0;

      // Push local changes to server (LOCAL WINS)
      for (const localTodo of localTodos) {
        const serverTodo = serverTodos.find((st) => st.id === localTodo.id);

        if (serverTodo && serverTodo.completed !== localTodo.completed) {
          console.log(`📤 Syncing: ${localTodo.title}`);
          await updateTodoCompletedOnServer({
            data: {
              id: localTodo.id,
              completed: localTodo.completed ?? false,
            },
          });
          syncCount++;
        } else if (!serverTodo) {
          console.log(`📤 Creating: ${localTodo.title}`);
          await insertTodoToServer({
            data: {
              id: localTodo.id,
              title: localTodo.title,
              completed: localTodo.completed ?? false,
              createdAt: localTodo.createdAt.toISOString(),
            },
          });
          syncCount++;
        }
      }

      if (syncCount > 0) {
        setSyncStatus(`${syncCount} elementos sincronizados`);
        router.invalidate();
      } else {
        setSyncStatus("Todo sincronizado");
      }
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("Error de sincronización");
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-semibold text-gray-800">Aprobaciones</span>
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-600" />
          ) : (
            <WifiOff className="w-5 h-5 text-orange-600" />
          )}
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out md:transform-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Sistema de Aprobaciones
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">
                    Conectado
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-orange-600 font-medium">
                    Sin conexión
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/demo"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            activeProps={{
              className:
                "flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium",
            }}
            activeOptions={{ exact: true }}
          >
            <Home className="w-5 h-5" />
            <span>Inicio</span>
          </Link>

          <Link
            to="/demo/approvals"
            onClick={closeSidebar}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            activeProps={{
              className:
                "flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium",
            }}
          >
            <ListTodo className="w-5 h-5" />
            <span>Aprobaciones</span>
          </Link>
        </nav>

        {/* Sync Button */}
        {isOnline && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>
                {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {/* Status Ribbon */}
        {syncStatus && (
          <div className="bg-green-500 text-white px-4 py-2 text-center text-sm font-medium">
            {syncStatus}
          </div>
        )}
        {!isOnline && !syncStatus && (
          <div className="bg-orange-500 text-white px-4 py-2 text-center text-sm font-medium">
            Sin conexión - Las aprobaciones se sincronizarán automáticamente al
            reconectar
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
