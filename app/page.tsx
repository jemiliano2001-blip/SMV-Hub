import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Compras Americanas</h1>
        <p className="text-gray-500 mb-8">Sistema de registro de compras en EUA — SMV</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/nueva-compra"
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Nueva compra
          </Link>
          <Link
            href="/ordenes"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Ver órdenes
          </Link>
          <Link
            href="/importar"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Importar masivo
          </Link>
          <Link
            href="/reportes"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reportes
          </Link>
        </div>
      </div>
    </main>
  )
}
