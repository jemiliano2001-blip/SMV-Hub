'use client'

import { useState } from 'react'
import { RefreshCw, Ghost, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Proveedor } from '@/lib/schemas'
import {
  aplicarVinculacionesAutomaticas,
  previsualizarVinculacionHistorica,
  vincularProveedorManual,
  type PrevisualizacionVinculacion,
  type ProveedorFantasma,
  type ResultadoAplicacionVinculacion,
} from '@/lib/proveedores-vinculacion'

interface Props {
  proveedores: Proveedor[]
}

export default function PanelVinculacionProveedores({ proveedores }: Props) {
  const [analizando, setAnalizando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [previsualizacion, setPrevisualizacion] = useState<PrevisualizacionVinculacion | null>(null)
  const [resultado, setResultado] = useState<ResultadoAplicacionVinculacion | null>(null)
  const [vinculando, setVinculando] = useState<string | null>(null)
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false)

  const totalVinculable =
    (previsualizacion?.ordenes.vinculados ?? 0) + (previsualizacion?.cotizaciones.vinculados ?? 0)

  async function analizarHistorico({ preservarResultado = false } = {}) {
    setAnalizando(true)
    try {
      const siguiente = await previsualizarVinculacionHistorica()
      setPrevisualizacion(siguiente)
      if (!preservarResultado) setResultado(null)
      toast.success('Análisis listo. Revisa los conteos antes de aplicar cambios.')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'No se pudo analizar el histórico.')
    } finally {
      setAnalizando(false)
    }
  }

  async function aplicarAutomaticas() {
    setAplicando(true)
    try {
      const aplicado = await aplicarVinculacionesAutomaticas()
      setResultado(aplicado)
      setConfirmacionAbierta(false)
      toast.success(`Se vincularon ${aplicado.ordenes.vinculados + aplicado.cotizaciones.vinculados} registros por nombre idéntico.`)
      await analizarHistorico({ preservarResultado: true })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar la vinculación.')
    } finally {
      setAplicando(false)
    }
  }

  async function handleVincularManual(fantasma: ProveedorFantasma, proveedorId: string) {
    if (!proveedorId) return
    const clave = `${fantasma.origen}-${fantasma.nombreLibre}`
    setVinculando(clave)
    try {
      await vincularProveedorManual(
        fantasma.origen === 'orden' ? 'ordenes' : 'cotizaciones',
        fantasma.idsDocs,
        proveedorId
      )
      toast.success(`"${fantasma.nombreLibre}" quedó vinculado.`)
      await analizarHistorico()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'No se pudo vincular manualmente.')
    } finally {
      setVinculando(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">
              <Ghost className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">Vincular histórico al catálogo</h2>
          </div>
          <p className="text-xs text-slate-500">
            Analiza órdenes y cotizaciones con proveedor como texto libre. Sólo un superadministrador
            puede aplicar vínculos y la coincidencia automática exige el nombre idéntico normalizado.
          </p>
        </div>
        <Button
          onClick={() => void analizarHistorico()}
          disabled={analizando || aplicando}
          className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-2 shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analizando ? 'animate-spin' : ''}`} />
          {analizando ? 'Analizando…' : 'Analizar histórico'}
        </Button>
      </div>

      {previsualizacion && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Resumen titulo="Órdenes" resultado={previsualizacion.ordenes} color="emerald" />
            <Resumen titulo="Cotizaciones" resultado={previsualizacion.cotizaciones} color="sky" />
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {totalVinculable > 0
                  ? `Se pueden aplicar ${totalVinculable} vínculos seguros. Los ${previsualizacion.ordenes.sinMatch + previsualizacion.cotizaciones.sinMatch} restantes requieren revisión manual.`
                  : 'No hay coincidencias automáticas pendientes. Revisa los nombres que requieren decisión manual.'}
              </span>
            </p>
            {totalVinculable > 0 && (
              <Button
                size="sm"
                onClick={() => setConfirmacionAbierta(true)}
                disabled={aplicando || analizando}
                className="bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold shrink-0"
              >
                Aplicar {totalVinculable} vínculos
              </Button>
            )}
          </div>
        </div>
      )}

      {resultado && (
        <p className="text-xs rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
          Última aplicación: {resultado.ordenes.vinculados} órdenes y {resultado.cotizaciones.vinculados} cotizaciones vinculadas.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-700">Nombres que requieren decisión manual</h3>
        {!previsualizacion && (
          <p className="text-xs text-slate-500 py-2">Primero analiza el histórico; no se modifica nada durante ese paso.</p>
        )}
        {previsualizacion?.fantasmas.length === 0 && (
          <p className="text-xs text-slate-500 py-2">No quedan proveedores sin correspondencia exacta.</p>
        )}
        {previsualizacion && previsualizacion.fantasmas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-2">Nombre libre</th>
                  <th className="p-2">Origen</th>
                  <th className="p-2 text-center" title="Un clic vincula hasta 20 documentos; vuelve a analizar para continuar si hay más.">Docs</th>
                  <th className="p-2">Vincular a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previsualizacion.fantasmas.map((fantasma) => {
                  const clave = `${fantasma.origen}-${fantasma.nombreLibre}`
                  return (
                    <tr key={clave}>
                      <td className="p-2 font-bold text-slate-900">{fantasma.nombreLibre}</td>
                      <td className="p-2 text-slate-500">{fantasma.origen === 'orden' ? 'Órdenes' : 'Cotizaciones'}</td>
                      <td className="p-2 text-center font-mono">{fantasma.cantidadDocs}</td>
                      <td className="p-2">
                        <select
                          defaultValue={fantasma.sugerenciaCatalogo?.id ?? ''}
                          disabled={vinculando === clave || analizando || aplicando}
                          onChange={(event) => void handleVincularManual(fantasma, event.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">Seleccionar proveedor…</option>
                          {proveedores.map((proveedor) => (
                            <option key={proveedor.id} value={proveedor.id}>
                              {proveedor.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={confirmacionAbierta} onOpenChange={setConfirmacionAbierta}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aplicar vínculos exactos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán {totalVinculable} registros que coinciden exactamente con el catálogo. Los nombres ambiguos o distintos permanecerán sin tocar para revisión manual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aplicando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={aplicando} onClick={() => void aplicarAutomaticas()}>
              {aplicando ? 'Aplicando…' : 'Aplicar vínculos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Resumen({
  titulo,
  resultado,
  color,
}: {
  titulo: string
  resultado: { vinculados: number; sinMatch: number; yaTenianId: number }
  color: 'emerald' | 'sky'
}) {
  const clases = color === 'emerald' ? 'bg-emerald-50 border-emerald-100' : 'bg-sky-50 border-sky-100'
  return (
    <div className={`rounded-lg border p-3 ${clases}`}>
      <p className="font-bold text-slate-800">{titulo}</p>
      <p className="text-slate-600">
        {resultado.vinculados} seguras · {resultado.sinMatch} manuales · {resultado.yaTenianId} ya vinculadas
      </p>
    </div>
  )
}
