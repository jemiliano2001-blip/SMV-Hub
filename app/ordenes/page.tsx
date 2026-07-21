/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: ordenes */
import Link from 'next/link'
import OrdenesList from './OrdenesList'
import AuthGuard from '../AuthGuard'
import { Plus } from 'lucide-react'

export default function OrdenesPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Órdenes de Compra</h1>
                <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                  Bitácora EUA
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulta utilitaria, estatus y notificaciones de compras registradas.
              </p>
            </div>
            <div>
              <Link
                href="/nueva-compra"
                className="inline-flex items-center justify-center rounded-lg bg-[#0369A1] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0284C7] transition-colors cursor-pointer shadow-xs active:scale-[0.98] gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Nueva compra
              </Link>
            </div>
          </div>

          <OrdenesList />
        </div>
      </main>
    </AuthGuard>
  )
}
