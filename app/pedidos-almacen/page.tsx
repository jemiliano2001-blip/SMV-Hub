import PedidosAlmacenView from './PedidosAlmacenView'
import AuthGuard from '../AuthGuard'

export default function PedidosAlmacenPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de almacén</h1>
          <p className="text-sm text-gray-500 mt-1">
            Anota qué necesitas que se compre — el dueño lo revisa aquí mismo.
          </p>
        </div>
        <PedidosAlmacenView />
      </div>
    </main>
    </AuthGuard>
  )
}
