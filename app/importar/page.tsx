import Link from 'next/link'
import ImportarTabs from './ImportarTabs'
import AuthGuard from '../AuthGuard'
import BotonSesion from '../BotonSesion'

export default function ImportarPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-blue-600">SMV</span>
              <span className="text-gray-300 font-light">|</span>
              <span className="text-sm font-semibold text-gray-700">Compras Americanas</span>
            </div>
            <nav className="flex space-x-6 text-sm font-medium">
              <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
                Inicio
              </Link>
              <Link href="/ordenes" className="text-gray-500 hover:text-gray-900 transition-colors">
                Ver Órdenes
              </Link>
              <Link href="/nueva-compra" className="text-gray-500 hover:text-gray-900 transition-colors">
                Nueva Compra
              </Link>
              <Link href="/cotizaciones" className="text-gray-500 hover:text-gray-900 transition-colors">
                Cotizaciones
              </Link>
              <BotonSesion />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Importar órdenes masivamente</h1>
          <p className="text-sm text-gray-500 mt-1">
            Carga compras históricas desde un CSV de Google Sheets o desde varias capturas/facturas
          </p>
        </div>
        <ImportarTabs />
      </div>
    </main>
    </AuthGuard>
  )
}
