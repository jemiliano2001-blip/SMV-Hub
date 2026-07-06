import Link from 'next/link'
import OrdenesList from './OrdenesList'
import AuthGuard from '../AuthGuard'

export default function OrdenesPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 flex flex-col">
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
