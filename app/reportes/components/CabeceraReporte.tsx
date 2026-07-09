'use client'

import { useState } from "react"
import Image from "next/image"
import { Mail } from "lucide-react"
import ModalEnviarReporte from "@/app/reportes/components/ModalEnviarReporte"
import type { Grupo, Kpis, CriterioAgrupacion } from "@/lib/reportes"

type Props = {
  titulo: string
  subtitulo: string
  moneda: string
  agruparPor: CriterioAgrupacion
  kpis: Kpis
  grupos: Grupo[]
  totalGeneral: number
}

const ETIQUETA_AGRUPACION: Record<CriterioAgrupacion, string> = {
  proveedor: "Proveedor",
  destino: "Destino",
  requisitor: "Requisitor",
}

export default function CabeceraReporte({
  titulo,
  subtitulo,
  moneda,
  agruparPor,
  kpis,
  grupos,
  totalGeneral,
}: Props) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const generadoEl = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const handleImprimir = () => {
    const tituloOriginal = document.title
    const fechasLimpio = subtitulo.replace(/[ \/—]+/g, '_')
    document.title = `Reporte_Compras_${fechasLimpio}_${ETIQUETA_AGRUPACION[agruparPor]}_${moneda}`
    window.print()
    document.title = tituloOriginal
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 print:mb-3 print:pb-3 print:border-0 print:bg-[#111111] print:text-white">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 print:hidden">{titulo}</h1>
            <p className="text-sm text-gray-500 print:hidden">{subtitulo}</p>
            <div className="hidden print:block">
              <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
              <p className="text-[8px] text-gray-400 mt-0.5 tracking-wide">S.A. de C.V.</p>
            </div>
          </div>
        </div>

        <div className="hidden print:block text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide">{titulo}</p>
          <p className="text-[8.5px] text-gray-400 mt-1">{subtitulo}</p>
        </div>

        <div className="hidden print:block text-right text-[8px] text-gray-400 leading-relaxed">
          <p>Agrupado por {ETIQUETA_AGRUPACION[agruparPor]} · {moneda}</p>
          <p>Generado el {generadoEl}</p>
        </div>

        <div className="no-print flex items-center gap-4">
          <Image
            src="/smv-logo.png"
            alt="SMV"
            width={92}
            height={32}
            className="object-contain"
            priority
          />
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Enviar
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ⬇ Guardar PDF
          </button>
        </div>
      </div>

      <ModalEnviarReporte
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={titulo}
        subtitulo={subtitulo}
        moneda={moneda}
        kpis={kpis}
        grupos={grupos}
        totalGeneral={totalGeneral}
      />
    </>
  )
}
