import Link from 'next/link'
import CotizacionesTabs from './CotizacionesTabs'
import AuthGuard from '../AuthGuard'
import BotonSesion from '../BotonSesion'

export default function CotizacionesPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2.5">
              <span className="text-xl font-bold text-[#0369A1] tracking-tight">SMV</span>
              <span className="text-gray-300 font-light">|</span>
              <span className="text-sm font-semibold text-[#0F172A]">Compras Americanas</span>
            </div>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Inicio
              </Link>
              <Link href="/ordenes" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Órdenes
              </Link>
              <Link href="/importar" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Importar
              </Link>
              <BotonSesion />
            </nav>
          </div>
        </div>
      </header>

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
