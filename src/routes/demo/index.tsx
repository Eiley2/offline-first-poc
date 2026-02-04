import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CheckCircle2, Clock, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/demo/")({
  component: DemoIndex,
  beforeLoad: async () => {
    throw redirect({ to: "/demo/approvals" });
  },
});

function DemoIndex() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Sistema de Aprobaciones Offline
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          Aprueba solicitudes, documentos y tareas incluso sin conexión a
          internet. Tus decisiones se guardan localmente y se sincronizan
          automáticamente cuando vuelvas a estar online.
        </p>
      </div>

      {/* Demo Card */}
      <Link to="/demo/approvals">
        <div className="bg-white border-2 border-gray-200 rounded-lg p-8 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Aprobaciones
              </h2>
              <p className="text-gray-500">
                Gestiona aprobaciones en cualquier momento
              </p>
            </div>
          </div>
          <p className="text-gray-600 text-lg">
            Accede a la lista de elementos pendientes de aprobación. Puedes
            aprobar o rechazar incluso sin conexión, y los cambios se
            sincronizarán automáticamente.
          </p>
        </div>
      </Link>

      {/* Benefits Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Beneficios para tu Negocio
        </h2>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Trabaja Sin Interrupciones
              </h3>
              <p className="text-gray-600">
                No dependas de la conexión a internet. Aprueba solicitudes en el
                campo, en el metro, o en cualquier lugar sin señal. Tu trabajo
                continúa sin pausas.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Sincronización Automática
              </h3>
              <p className="text-gray-600">
                Cuando recuperes la conexión, todos tus cambios se sincronizan
                automáticamente con el servidor. No necesitas hacer nada, el
                sistema se encarga de todo.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Respuesta Instantánea
              </h3>
              <p className="text-gray-600">
                Las acciones se guardan localmente al instante. No hay esperas
                ni tiempos de carga. La aplicación responde inmediatamente a
                cada acción.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
