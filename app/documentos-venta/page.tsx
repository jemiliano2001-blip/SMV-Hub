import { Suspense } from 'react'
import AuthGuard from '../AuthGuard'
import DocumentosVentaView from './DocumentosVentaView'

export default function DocumentosVentaPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] py-6 px-4 sm:px-6 font-sans">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Documentos de venta
              </h1>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                Remisión / Factura
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pide remisiones o facturas de órdenes de venta Odoo y chatea con ventas en Hub.
            </p>
          </div>
          <Suspense
            fallback={
              <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
            }
          >
            <DocumentosVentaView />
          </Suspense>
        </div>
      </main>
    </AuthGuard>
  )
}
