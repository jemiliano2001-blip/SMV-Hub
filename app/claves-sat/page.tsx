import AuthGuard from "../AuthGuard"
import BuscadorClavesSat from "./BuscadorClavesSat"

export default function ClavesSatPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Claves SAT</h1>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                Catálogo c_ClaveProdServ
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta el catálogo local y usa la clave correcta al capturar tus compras.
            </p>
          </div>
          <BuscadorClavesSat />
        </div>
      </main>
    </AuthGuard>
  )
}
