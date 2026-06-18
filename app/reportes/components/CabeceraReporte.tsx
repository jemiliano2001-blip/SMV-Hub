'use client'

import Image from "next/image"

type Props = { titulo: string; subtitulo: string }

export default function CabeceraReporte({ titulo, subtitulo }: Props) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-center gap-4">
        <Image
          src="/smv-logo.png"
          alt="SMV"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">{subtitulo}</p>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        ⬇ Guardar PDF
      </button>
    </div>
  )
}
