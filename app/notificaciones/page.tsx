import AuthGuard from '../AuthGuard'
import NotificacionesView from './NotificacionesView'

export default function NotificacionesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] py-6 px-4 sm:px-6 font-sans">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Notificaciones</h1>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-[#0369A1] border border-sky-200 px-1.5 py-0.5 rounded">
                Operación
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Avisos del taller: pedidos de almacén y requisiciones.
            </p>
          </div>
          <NotificacionesView />
        </div>
      </main>
    </AuthGuard>
  )
}
