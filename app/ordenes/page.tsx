import Link from 'next/link'
import OrdenesList from './OrdenesList'
import AuthGuard from '../AuthGuard'
import BotonSesion from '../BotonSesion'

export default function OrdenesPage() {
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
              <Link href="/nueva-compra" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Nueva Compra
              </Link>
              <Link href="/importar" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Importar
              </Link>
              <Link href="/cotizaciones" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">
                Cotizaciones
              </Link>
              <BotonSesion />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Órdenes de compra</h1>
            <p className="text-sm text-gray-500 mt-1">
              Listado y gestión de compras registradas en EUA
            </p>
          </div>
          <div>
            <Link
              href="/nueva-compra"
              className="inline-flex items-center justify-center rounded-lg bg-[#0369A1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0284C7] focus:outline-none focus:ring-2 focus:ring-[#0369A1] focus:ring-offset-2 transition-colors duration-150 cursor-pointer"
            >
              + Nueva compra
            </Link>
          </div>
        </div>

        <OrdenesList />
      </div>
    </main>
    </AuthGuard>
  )
}
