/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: pedidos-almacen */
import PedidosAlmacenView from './PedidosAlmacenView'
import AuthGuard from '../AuthGuard'

export default function PedidosAlmacenPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] py-6 px-4 sm:px-6 font-sans">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Pedidos de almacén</h1>
              <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                Requerimientos
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Registra requerimientos inmediatos de material o herramienta para convertirlos en compras.
            </p>
          </div>
          <PedidosAlmacenView />
        </div>
      </main>
    </AuthGuard>
  )
}
