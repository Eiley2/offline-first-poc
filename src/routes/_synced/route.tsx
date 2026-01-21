import { getPosts, syncOnConnect } from "@/db/query";
import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_synced")({
  component: RouteComponent,
  loader: () => getPosts(),
});

function RouteComponent() {
  useEffect(() => {
    const handleOnline = () => {
      syncOnConnect();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);
  return (
    <>
      <ClientOnly>
        <IsOfflineRibbon />
      </ClientOnly>
      <Outlet />
    </>
  );
}

function IsOfflineRibbon() {
  const isOffline = !navigator.onLine;
  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 w-full bg-blue-400 text-white p-2 z-50">
        Offline
      </div>
    );
  }
  return null;
}
