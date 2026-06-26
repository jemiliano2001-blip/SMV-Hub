'use client'

import { useState } from 'react'
import { FileSpreadsheet, Images } from 'lucide-react'
import ImportarCSV from './ImportarCSV'
import ImportarCapturas from './ImportarCapturas'

type Modo = 'csv' | 'capturas'

export default function ImportarTabs() {
  const [modo, setModo] = useState<Modo>('csv')

  const tab = (valor: Modo, label: string, Icon: typeof FileSpreadsheet) => (
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
        {tab('csv', 'Desde CSV / Google Sheets', FileSpreadsheet)}
        {tab('capturas', 'Desde capturas', Images)}
      </div>
      {modo === 'csv' ? <ImportarCSV /> : <ImportarCapturas />}
    </div>
  )
}
