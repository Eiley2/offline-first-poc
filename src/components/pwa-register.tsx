import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PWARegister() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered: " + r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (offlineReady) {
      console.log("App ready to work offline");
    }
  }, [offlineReady]);

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex flex-col gap-3">
            {offlineReady ? (
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
                  onClick={() => updateServiceWorker(true)}
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
