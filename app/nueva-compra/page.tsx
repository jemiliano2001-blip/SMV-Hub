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
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Nueva compra americana</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sube la factura para extracción automática o captura los datos manualmente
          </p>
        </div>
        <NuevaCompraFormWrapper pedidoId={pedidoId} descripcionInicial={descripcion} />
      </div>
    </main>
    </AuthGuard>
  )
}
