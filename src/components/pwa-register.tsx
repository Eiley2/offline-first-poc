import { useEffect, useState } from "react";

export function PWARegister() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("Service Workers not supported");
      return;
    }

    const registerSW = async () => {
      try {
        console.log("[PWA] Registering service worker...");
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[PWA] Service Worker registered successfully:", reg);
        setRegistration(reg);
        setOfflineReady(true);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          console.log("[PWA] New service worker found");

          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[PWA] New version available");
                setNeedRefresh(true);
              }
            });
          }
        });

        // Auto-check for updates every hour
        setInterval(
          () => {
            reg.update();
          },
          60 * 60 * 1000
        );
      } catch (error) {
        console.error("[PWA] Service Worker registration failed:", error);
      }
    };

    registerSW();
  }, []);

  const updateServiceWorker = async () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  };

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex flex-col gap-3">
            {offlineReady && !needRefresh ? (
              <p className="text-sm text-gray-700">
                ✅ La aplicación está lista para trabajar sin conexión
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                🔄 Nueva versión disponible, haz clic en recargar para
                actualizar
              </p>
            )}
            <div className="flex gap-2">
              {needRefresh && (
                <button
                  onClick={updateServiceWorker}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Recargar
                </button>
              )}
              <button
                onClick={close}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
