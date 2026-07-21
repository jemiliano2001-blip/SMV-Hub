/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: nueva-compra */
import NuevaCompraFormWrapper from './NuevaCompraFormWrapper'
import AuthGuard from '../AuthGuard'

type SearchParams = Promise<{ pedidoId?: string; descripcion?: string }>

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { pedidoId, descripcion } = await searchParams

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] py-6 px-4 sm:px-6 font-sans">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Nueva Compra Americana</h1>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                Extracción IA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Escaneo automático de facturas en PDF/Imagen mediante IA o captura rápida de datos.
            </p>
          </div>
          <NuevaCompraFormWrapper pedidoId={pedidoId} descripcionInicial={descripcion} />
        </div>
      </main>
    </AuthGuard>
  )
}
