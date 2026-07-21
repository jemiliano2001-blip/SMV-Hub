/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: cotizaciones */
import CotizacionesTabs from './CotizacionesTabs'
import AuthGuard from '../AuthGuard'

export default function CotizacionesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Cotizaciones</h1>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                Histórico MX / USA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Base de datos utilitaria de piezas cotizadas previamente para comparación de costos.
            </p>
          </div>

          <CotizacionesTabs />
        </div>
      </main>
    </AuthGuard>
  )
}
