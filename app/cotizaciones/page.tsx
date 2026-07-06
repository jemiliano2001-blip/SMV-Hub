import CotizacionesTabs from './CotizacionesTabs'
import AuthGuard from '../AuthGuard'

export default function CotizacionesPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Base de datos histórica de cotizaciones — busca piezas cotizadas en México o EUA
          </p>
        </div>

        <CotizacionesTabs />
      </div>
    </main>
    </AuthGuard>
  )
}
