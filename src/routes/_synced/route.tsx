import { getPosts, syncOnConnect, syncPostsToServer } from "@/db/query";
import { ClientOnly, createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_synced")({
  component: RouteComponent,
  loader: () => getPosts(),
});

function RouteComponent() {
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      console.log("🔄 Reconnected! Starting sync...");
      setIsOnline(true);
      setSyncStatus("Syncing...");

      try {
        // First, sync client posts to server (client → server)
        const clientToServerResult = await syncPostsToServer();
        console.log("📤 Client → Server sync:", clientToServerResult);

        // Then, sync server posts to client (server → client)
        const serverToClientResult = await syncOnConnect();
        console.log("📥 Server → Client sync:", serverToClientResult);

        if (clientToServerResult.synced || serverToClientResult.synced) {
          setSyncStatus(`Synced ${(clientToServerResult.count || 0) + (serverToClientResult.count || 0)} items`);
          // Refresh the page data
          router.invalidate();
          setTimeout(() => setSyncStatus(null), 3000);
        } else {
          setSyncStatus("Already in sync");
          setTimeout(() => setSyncStatus(null), 2000);
        }
      } catch (error) {
        console.error("Sync error:", error);
        setSyncStatus("Sync failed");
        setTimeout(() => setSyncStatus(null), 3000);
      }
    };

    const handleOffline = () => {
      console.log("📴 Disconnected");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleManualSync = async () => {
    console.log("🔄 Manual sync triggered...");
    setSyncStatus("Syncing...");

    try {
      const clientToServerResult = await syncPostsToServer();
      console.log("📤 Client → Server sync:", clientToServerResult);

      const serverToClientResult = await syncOnConnect();
      console.log("📥 Server → Client sync:", serverToClientResult);

      if (clientToServerResult.synced || serverToClientResult.synced) {
        setSyncStatus(`Synced ${(clientToServerResult.count || 0) + (serverToClientResult.count || 0)} items`);
        router.invalidate();
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        setSyncStatus("Already in sync");
        setTimeout(() => setSyncStatus(null), 2000);
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus("Sync failed");
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  return (
    <>
      <ClientOnly>
        <IsOfflineRibbon syncStatus={syncStatus} isOnline={isOnline} onManualSync={handleManualSync} />
      </ClientOnly>
      <Outlet />
    </>
  );
}

function IsOfflineRibbon({
  syncStatus,
  isOnline,
  onManualSync
}: {
  syncStatus: string | null;
  isOnline: boolean;
  onManualSync: () => void;
}) {
  if (syncStatus) {
    return (
      <div className="fixed top-0 left-0 w-full bg-green-500 text-white p-2 z-50 text-center">
        {syncStatus}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 w-full bg-blue-400 text-white p-2 z-50 text-center flex items-center justify-center gap-4">
        <span>📴 Offline - Changes will sync when reconnected</span>
      </div>
    );
  }

  // Show manual sync button when online
  return (
    <div className="fixed top-0 right-4 mt-2 z-50">
      <button
        onClick={onManualSync}
        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
      >
        🔄 Sync Now
      </button>
    </div>
  );
}
