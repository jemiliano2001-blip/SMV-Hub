'use client'

/**
 * Backfill de `mercado` / `origenProveedor` (super-admin). Previsualiza → aplica; cada aplicación
 * queda auditada. Es repetible: cuando lleguen proveedores nuevos sin el campo, se vuelve a correr.
 */

import { useMemo, useState } from 'react'
import { AlertCircle, Check, Globe2, RefreshCw, Search } from 'lucide-react'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import {
  aplicarBackfillMercado,
  previsualizarBackfillMercado,
  type PlanBackfillMercado,
} from '@/lib/proveedores-backfill-mercado'
import { reindexarBusquedaSemantica } from '@/lib/services/busqueda-indice-sync'

export default function PanelBackfillMercado() {
  const confirmar = useConfirmDialog()
  const [plan, setPlan] = useState<PlanBackfillMercado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [reindexando, setReindexando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function previsualizar() {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      setPlan(await previsualizarBackfillMercado())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo previsualizar.')
    } finally {
      setCargando(false)
    }
  }

  async function aplicar() {
    if (!plan || plan.cambios.length === 0) return
    const ok = await confirmar({
      title: 'Persistir mercado en proveedores',
      description: `Se escribirá mercado/origen en ${plan.cambios.length} proveedor(es) siguiendo la regla: con partner de Odoo → México; sin partner → USA. No se pisa ningún valor ya guardado. Queda auditado.`,
      confirmLabel: 'Aplicar',
    })
    if (!ok) return
    setAplicando(true)
    setError(null)
    try {
      const r = await aplicarBackfillMercado()
      setMensaje(`Listo: mercado en ${r.conMercado}, origen en ${r.conOrigen}; ${r.sinCambio} ya estaban completos.`)
      await previsualizar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar.')
    } finally {
      setAplicando(false)
    }
  }

  async function reindexar() {
    const ok = await confirmar({
      title: 'Refrescar índice de búsqueda',
      description:
        'Recorre órdenes y proveedores y actualiza busqueda_indice. Solo re-embebe lo que cambió de texto (gasta Gemini); lo que solo cambió de mercado se refresca sin costo.',
      confirmLabel: 'Refrescar',
    })
    if (!ok) return
    setReindexando(true)
    setError(null)
    try {
      const r = await reindexarBusquedaSemantica()
      setMensaje(
        `Índice: ${r.entradasEsperadas} entradas (${r.ordenesLeidas} órdenes · ${r.proveedoresLeidos} proveedores${r.cotizacionesLeidas != null ? ` · ${r.cotizacionesLeidas} cotizaciones` : ''}) · ${r.reembebidas} re-embebidas · ${r.metadataActualizadas} con metadata refrescada · ${r.sinCambios} sin cambios · ${r.podadas} podadas.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo refrescar el índice.')
    } finally {
      setReindexando(false)
    }
  }

  const resumen = useMemo(() => {
    if (!plan) return null
    const mexico = plan.cambios.filter((c) => c.cambios.mercado === 'mexico').length
    const usa = plan.cambios.filter((c) => c.cambios.mercado === 'usa').length
    const origen = plan.cambios.filter((c) => c.cambios.origenProveedor).length
    return { mexico, usa, origen }
  }, [plan])

  return (
    <ModuleSurface id="panel-backfill-mercado" className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" /> Mercado persistido
          </h3>
          <p className="text-xs text-muted-foreground">
            Guarda en cada proveedor el mercado que hoy la app deduce al leer, para que el buscador, el
            sync de Odoo y los reportes lo vean igual. Regla: partner de Odoo → México; sin partner → USA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={cargando || aplicando} onClick={() => void previsualizar()}>
            <RefreshCw className={cargando ? 'animate-spin' : ''} /> {plan ? 'Volver a revisar' : 'Previsualizar'}
          </Button>
          <Button type="button" size="sm" disabled={!plan || plan.cambios.length === 0 || aplicando} onClick={() => void aplicar()}>
            <Check /> Aplicar {plan ? `(${plan.cambios.length})` : ''}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={reindexando || aplicando} onClick={() => void reindexar()}>
            <Search className={reindexando ? 'animate-pulse' : ''} /> {reindexando ? 'Refrescando…' : 'Refrescar índice de búsqueda'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {mensaje && !error && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">{mensaje}</p>}

      {plan && resumen && (
        <>
          <p className="text-xs text-muted-foreground">
            {plan.total} proveedores · <span className="font-semibold text-foreground">{plan.cambios.length}</span> por completar
            (México {resumen.mexico} · USA {resumen.usa} · origen Odoo {resumen.origen}) · {plan.sinCambio} ya completos
          </p>
          {plan.cambios.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 py-2">Proveedor</TableHead>
                    <TableHead className="px-3 py-2">Regla</TableHead>
                    <TableHead className="px-3 py-2">Se guardará</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.cambios.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="px-3 py-1.5 text-xs font-medium text-foreground max-w-[260px]">
                        <span className="block truncate" title={c.nombre}>{c.nombre}</span>
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">{c.regla}</TableCell>
                      <TableCell className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {c.cambios.mercado && (
                            <Badge variant="secondary" className="text-[10px]">
                              mercado: {c.cambios.mercado === 'mexico' ? 'México' : 'USA'}
                            </Badge>
                          )}
                          {c.cambios.origenProveedor && (
                            <Badge variant="outline" className="text-[10px]">origen: odoo</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {!plan && !cargando && (
        <p className="text-xs text-muted-foreground">
          Pulsa <span className="font-semibold">Previsualizar</span> para ver qué se escribiría. No cambia nada hasta aplicar.
        </p>
      )}
    </ModuleSurface>
  )
}
