import OrdenesServicioList from './OrdenesServicioList'
import AuthGuard from '../AuthGuard'

export default function OrdenesServicioPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Órdenes de servicio</h1>
            <p className="text-sm text-gray-500 mt-1">
              Seguimiento de OTs con proveedores externos — haz clic en el estatus para actualizarlo
            </p>
          </div>

          <OrdenesServicioList />
        </div>
      </main>
    </AuthGuard>
  )
}
