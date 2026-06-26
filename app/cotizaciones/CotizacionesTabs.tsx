'use client'

import { useState } from 'react'
import { Search, Upload } from 'lucide-react'
import CotizacionesList from './CotizacionesList'
import ImportarCotizaciones from './ImportarCotizaciones'

type Modo = 'consultar' | 'importar'

export default function CotizacionesTabs() {
  const [modo, setModo] = useState<Modo>('consultar')

  const tab = (valor: Modo, label: string, Icon: typeof Search) => (
    <button
      onClick={() => setModo(valor)}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        modo === valor
          ? 'bg-blue-600 text-white shadow-sm'
          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {tab('consultar', 'Consultar', Search)}
        {tab('importar', 'Importar desde Sheet', Upload)}
      </div>
      {modo === 'consultar' ? <CotizacionesList /> : <ImportarCotizaciones />}
    </div>
  )
}
