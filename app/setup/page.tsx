"use client"

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Configuración Requerida</h2>
          <p className="text-gray-600 mb-6">Las credenciales de la base de datos no están configuradas</p>
        </div>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Pasos para configurar:</h3>
            <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
              <li>
                Ve a{" "}
                <a href="https://supabase.com/dashboard" target="_blank" className="underline" rel="noreferrer">
                  supabase.com/dashboard
                </a>
              </li>
              <li>Selecciona tu proyecto</li>
              <li>Ve a Settings → API</li>
              <li>Copia la URL del proyecto y las claves necesarias</li>
              <li>
                Crea un archivo <code className="bg-yellow-100 px-1 rounded">.env.local</code> en la raíz del proyecto
              </li>
              <li>Agrega las credenciales al archivo siguiendo la documentación de Supabase</li>
            </ol>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Documentación:</h3>
            <p className="text-sm text-blue-700">
              Consulta la{" "}
              <a
                href="https://supabase.com/docs/guides/getting-started/quickstarts/nextjs"
                target="_blank"
                className="underline"
                rel="noreferrer"
              >
                documentación oficial de Supabase
              </a>{" "}
              para obtener instrucciones detalladas sobre la configuración.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Reintentar después de configurar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
