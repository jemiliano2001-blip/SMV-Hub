import OperadoresList from './OperadoresList'
import AuthGuard from '../AuthGuard'

export default function OperadoresPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Catálogo de operadores</h1>
            <p className="text-sm text-gray-500 mt-1">
              Lista maestra de operadores y personal — se usa como fuente para autocompletar nombres en otros módulos
            </p>
          </div>

          <OperadoresList />
        </div>
      </main>
    </AuthGuard>
  )
}
