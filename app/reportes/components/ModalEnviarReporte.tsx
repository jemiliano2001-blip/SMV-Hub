'use client'

import { useState } from "react"
import { X, Mail } from "lucide-react"
import type { Grupo, Kpis } from "@/lib/reportes"

type Props = {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  subtitulo: string
  moneda: string
  kpis: Kpis
  grupos: Grupo[]
  totalGeneral: number
}

function fmt(monto: number, moneda: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto)
}

function generarCuerpo(
  titulo: string,
  subtitulo: string,
  moneda: string,
  kpis: Kpis,
  grupos: Grupo[],
  totalGeneral: number,
): string {
  const sep = "─".repeat(48)

  let txt = `${titulo} — ${subtitulo}\n${sep}\n\n`

  txt += `RESUMEN\n${sep}\n`
  txt += `Órdenes:       ${kpis.numOrdenes}\n`
  txt += `Artículos:     ${kpis.numArticulos}\n`
  txt += `Proveedores:   ${kpis.numProveedores}\n`
  txt += `Total gastado: ${fmt(kpis.totalComprado, moneda)}\n\n`

  txt += `DETALLE POR GRUPO\n${sep}\n`
  for (const g of grupos) {
    txt += `▸ ${g.clave}  →  ${fmt(g.total, moneda)}\n`
    for (const l of g.lineas) {
      txt += `   - ${l.referencia} | ${l.descripcion} (${l.cantidad ?? 1}x): ${fmt(l.total, moneda)}\n`
    }
    txt += "\n"
  }

  txt += `\n${sep}\n`
  txt += `TOTAL GENERAL: ${fmt(totalGeneral, moneda)}\n`
  txt += `${sep}\n\n`
  txt += `Generado automáticamente — SMV Hub`

  return txt
}

export default function ModalEnviarReporte({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  moneda,
  kpis,
  grupos,
  totalGeneral,
}: Props) {
  const [destinatarios, setDestinatarios] = useState("")

  if (!abierto) return null

  function cerrar() {
    setDestinatarios("")
    onCerrar()
  }

  function handleEnviar() {
    const asunto = `Reporte de compras — ${subtitulo} (${moneda})`
    const cuerpo = generarCuerpo(titulo, subtitulo, moneda, kpis, grupos, totalGeneral)
    const mailtoUrl = `mailto:${encodeURIComponent(destinatarios)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.open(mailtoUrl, "_blank")
    cerrar()
  }

  const valido = destinatarios.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Enviar reporte por correo</h2>
          <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Se abrirá tu cliente de correo con el reporte pre-llenado.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Destinatarios
            <span className="text-gray-400 font-normal ml-1">(separados por coma)</span>
          </label>
          <textarea
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            rows={3}
            placeholder="gerencia@empresa.com, contabilidad@empresa.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!valido}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="h-4 w-4" />
            Abrir correo
          </button>
        </div>
      </div>
    </div>
  )
}
