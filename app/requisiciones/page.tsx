/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: requisiciones */
import RequisicionesList from './RequisicionesList'
import AuthGuard from '../AuthGuard'

export default function RequisicionesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Requisiciones de compra</h1>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">
                Ingeniería & Taller
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control utilitario de solicitudes de material y automatización levantadas por el equipo.
            </p>
          </div>

          <RequisicionesList />
        </div>
      </main>
    </AuthGuard>
  )
}
