import AuthGuard from "../AuthGuard"
import BuscadorClavesSat from "./BuscadorClavesSat"

export default function ClavesSatPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Claves SAT</h1>
            <p className="text-sm text-gray-500 mt-1">
              Consulta el catálogo local de `c_ClaveProdServ` y usa la clave correcta al capturar tus compras.
            </p>
          </div>
          <BuscadorClavesSat />
        </div>
      </main>
    </AuthGuard>
  )
}
