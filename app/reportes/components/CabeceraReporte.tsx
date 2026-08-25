'use client'

import { useState } from "react"
import Image from "next/image"
import { Mail, Download, FileSpreadsheet } from "lucide-react"
import ModalEnviarReporte from "@/app/reportes/components/ModalEnviarReporte"
import type { Grupo, Kpis, CriterioAgrupacion } from "@/lib/reportes"
import { generarExcelReporteCompras } from "@/lib/reportes-compras-export"
import { descargarExcelEnNavegador } from "@/lib/excel-export-base"
import { toast } from "sonner"

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
  const [exportandoExcel, setExportandoExcel] = useState(false)
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

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const lineas = grupos.flatMap((g) => g.lineas)
      if (lineas.length === 0) {
        toast.info("No hay partidas para exportar en este periodo.")
        return
      }
      const buffer = await generarExcelReporteCompras({
        lineas,
        subtitulo,
        moneda,
      })
      const fechasLimpio = subtitulo.replace(/[ \/—]+/g, '_')
      descargarExcelEnNavegador(buffer, `Reporte_Compras_${fechasLimpio}_${moneda}.xlsx`)
      toast.success("Reporte de compras exportado a Excel")
    } catch (error) {
      console.error("Error exportando reporte de compras a Excel:", error)
      toast.error("No se pudo exportar el archivo Excel. Intenta de nuevo.")
    } finally {
      setExportandoExcel(false)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between print:mb-3 print:pb-3 print:border-0 print:bg-[#111111] print:text-white">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-foreground print:hidden">{titulo}</h1>
            <p className="text-xs text-muted-foreground print:hidden">{subtitulo}</p>
            <div className="hidden print:block">
              <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
              <p className="mt-0.5 text-[8px] tracking-wide print:text-gray-400">S.A. de C.V.</p>
            </div>
          </div>
        </div>

        <div className="hidden print:block text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide">{titulo}</p>
          <p className="mt-1 text-[8.5px] print:text-gray-400">{subtitulo}</p>
        </div>

        <div className="hidden print:block text-right text-[8px] leading-relaxed print:text-gray-400">
          <p>Agrupado por {ETIQUETA_AGRUPACION[agruparPor]} · {moneda}</p>
          <p>Generado el {generadoEl}</p>
        </div>

        <div className="no-print flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Image
            src="/smv-logo.png"
            alt="SMV"
            width={92}
            height={32}
            className="mr-auto hidden object-contain sm:block"
            priority
          />
          <button
            onClick={handleExportarExcel}
            disabled={exportandoExcel || grupos.length === 0}
            className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 sm:flex-none"
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Excel
          </button>
          <button
            onClick={() => setModalAbierto(true)}
            className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted sm:flex-none"
          >
            <Mail className="h-4 w-4" />
            Enviar
          </button>
          <button
            onClick={handleImprimir}
            className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted sm:flex-none"
          >
            <Download className="size-4" aria-hidden />
            Guardar PDF
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
