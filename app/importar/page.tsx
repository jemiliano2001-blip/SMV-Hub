import ImportarTabs from './ImportarTabs'
import AuthGuard from '../AuthGuard'

export default function ImportarPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-gray-50 flex flex-col">
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
