'use client'

import { useState, useEffect, Fragment } from 'react'
import { Loader2, Search, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OrdenCompra, ItemFactura } from '@/lib/schemas'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'
import { validarClaveProdServCatalogo } from '@/lib/sat/validar-clave'
import { actualizarClavesSatLote } from '@/lib/ordenes'
import { getClienteAuth } from '@/lib/firebase'
import { extraerEntradasHistorialSat } from '@/lib/sat/extraer-historial-ordenes'
import {
  itemPayloadSugerirClaveSat,
  partirLoteSugerirClaveSat,
} from '@/lib/sat/payload-sugerir-clave'
import { guardarAsignacionesSatValidadas } from '@/lib/sat/mapeos-persistir'
import type { AlternativaSat } from '@/lib/sat/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SugerenciaApi = {
  claveProdServ: string | null
  descripcionSat: string | null
  confianza: 'alta' | 'media' | 'baja'
  motivo: string
  fuente: string
  terminosBusqueda?: string
  alternativas?: AlternativaSat[]
}

export type FilaSugerenciaSat = {
  ordenId: string
  ordenProveedor: string
  itemIndex: number
  descripcion: string
  claveProdServ: string
  descripcionSat: string | null
  confianza: 'alta' | 'media' | 'baja'
  motivo: string
  fuente: string
  terminosBusqueda: string
  alternativas: AlternativaSat[]
  aplicar: boolean
  buscando: boolean
  mostrarAlternativas: boolean
}

interface Props {
  ordenes: OrdenCompra[]
  historialOrdenes: OrdenCompra[]
  onClose: () => void
  onApplied: (ordenesActualizadas: OrdenCompra[]) => void
}

function confianzaClase(confianza: FilaSugerenciaSat['confianza']): string {
  switch (confianza) {
    case 'alta':
      return 'bg-green-100 text-green-800'
    case 'media':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-red-100 text-red-800'
  }
}

function necesitaAdvertencia(fila: FilaSugerenciaSat): boolean {
  return (
    fila.confianza !== 'alta' &&
    (fila.fuente === 'glosario' || fila.fuente === 'traduccion' || fila.fuente === 'ia_rag')
  )
}

function itemsPendientes(orden: OrdenCompra): number[] {
  return (orden.items ?? [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.satPendiente !== false && !normalizarClaveProdServ(item.claveProdServ))
    .map(({ index }) => index)
}

export default function ModalSugerirClavesSat({
  ordenes,
  historialOrdenes,
  onClose,
  onApplied,
}: Props) {
  const [filas, setFilas] = useState<FilaSugerenciaSat[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function cargarSugerencias() {
      setLoading(true)
      setError(null)

      const pendientes: Array<{ orden: OrdenCompra; itemIndex: number }> = []
      for (const orden of ordenes) {
        for (const idx of itemsPendientes(orden)) {
          pendientes.push({ orden, itemIndex: idx })
        }
      }

      if (pendientes.length === 0) {
        if (!cancelled) {
          setFilas([])
          setLoading(false)
        }
        return
      }

      try {
        const auth = getClienteAuth()
        const token = await auth.currentUser?.getIdToken()

        const items = pendientes.map(({ orden, itemIndex }) =>
          itemPayloadSugerirClaveSat({
            descripcion: orden.items[itemIndex]?.descripcion,
            proveedor: orden.proveedor,
          })
        )

        const historialEntradas = extraerEntradasHistorialSat(historialOrdenes)
        const sugerencias: SugerenciaApi[] = []

        for (const lote of partirLoteSugerirClaveSat(items)) {
          if (cancelled) return
          const res = await fetch('/api/sugerir-clave-sat', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ items: lote, historialEntradas }),
          })

          const data = await res.json() as { error?: string; sugerencias?: SugerenciaApi[] }
          if (!res.ok) throw new Error(data.error || 'Error al obtener sugerencias')
          sugerencias.push(...(data.sugerencias ?? []))
        }
        if (!cancelled) {
          setFilas(
            pendientes.map(({ orden, itemIndex }, i) => {
              const sug = sugerencias[i]
              const tieneClave = Boolean(sug?.claveProdServ)
              return {
                ordenId: orden.id,
                ordenProveedor: orden.proveedor,
                itemIndex,
                descripcion: orden.items[itemIndex].descripcion,
                claveProdServ: sug?.claveProdServ ?? '',
                descripcionSat: sug?.descripcionSat ?? null,
                confianza: sug?.confianza ?? 'baja',
                motivo: sug?.motivo ?? 'Sin sugerencia',
                fuente: sug?.fuente ?? 'manual',
                terminosBusqueda: sug?.terminosBusqueda ?? '',
                alternativas: sug?.alternativas ?? [],
                aplicar: tieneClave && sug?.confianza === 'alta',
                buscando: false,
                mostrarAlternativas: (sug?.alternativas?.length ?? 0) > 0,
              }
            })
          )
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void cargarSugerencias()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [ordenes, historialOrdenes, reloadKey])

  const actualizarFila = (index: number, cambios: Partial<FilaSugerenciaSat>) => {
    setFilas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...cambios } : f))
    )
  }

  const aplicarAlternativa = (filaIndex: number, alt: AlternativaSat) => {
    actualizarFila(filaIndex, {
      claveProdServ: alt.clave,
      descripcionSat: alt.descripcionSat,
      confianza: 'media',
      motivo: 'Alternativa seleccionada manualmente',
      fuente: 'manual',
      aplicar: true,
    })
  }

  const buscarClaveInline = async (filaIndex: number, query: string) => {
    if (!query.trim()) return
    actualizarFila(filaIndex, { buscando: true })
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '5' })
      const token = await getClienteAuth().currentUser?.getIdToken()
      const res = await fetch(`/api/claves-sat?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json()
      const top = data.results?.[0]
      if (top) {
        actualizarFila(filaIndex, {
          claveProdServ: top.entry.clave,
          descripcionSat: top.entry.descripcion,
          confianza: 'media',
          motivo: 'Selección manual del catálogo',
          fuente: 'manual',
          aplicar: true,
          buscando: false,
        })
      } else {
        actualizarFila(filaIndex, { buscando: false })
      }
    } catch {
      actualizarFila(filaIndex, { buscando: false })
    }
  }

  const handleAplicar = async () => {
    const filasAplicar = filas.filter((f) => f.aplicar && validarClaveProdServCatalogo(f.claveProdServ))
    if (filasAplicar.length === 0) {
      setError('Selecciona al menos una fila con una clave SAT existente en el catálogo.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const porOrden = new Map<string, Map<number, string>>()
      for (const fila of filasAplicar) {
        const clave = validarClaveProdServCatalogo(fila.claveProdServ)
        if (!clave) continue
        if (!porOrden.has(fila.ordenId)) porOrden.set(fila.ordenId, new Map())
        porOrden.get(fila.ordenId)!.set(fila.itemIndex, clave)
      }

      const actualizaciones: Array<{ ordenId: string; items: ItemFactura[] }> = []
      const ordenesActualizadas: OrdenCompra[] = []

      for (const orden of ordenes) {
        const cambios = porOrden.get(orden.id)
        if (!cambios) continue

        const itemsActualizados = orden.items.map((item, idx) => {
          const nuevaClave = cambios.get(idx)
          if (!nuevaClave) return item
          return {
            ...item,
            claveProdServ: nuevaClave,
            satPendiente: false,
          }
        })

        actualizaciones.push({ ordenId: orden.id, items: itemsActualizados })
        ordenesActualizadas.push({
          ...orden,
          items: itemsActualizados,
          actualizadoEn: new Date(),
        })
      }

      await actualizarClavesSatLote(actualizaciones)

      const auth = getClienteAuth()
      const email = auth.currentUser?.email ?? undefined
      try {
        await guardarAsignacionesSatValidadas(
          filasAplicar.map((f) => ({
            descripcion: f.descripcion,
             claveProdServ: validarClaveProdServCatalogo(f.claveProdServ)!,
            validadoPor: email,
          }))
        )
      } catch {
        // No bloquear si falla el mapeo auxiliar
      }

      onApplied(ordenesActualizadas)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las claves')
    } finally {
      setSaving(false)
    }
  }

  const filasConClave = filas.filter((f) => f.aplicar && validarClaveProdServCatalogo(f.claveProdServ)).length

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Sugerir claves SAT</DialogTitle>
          <DialogDescription>
            Solo se preseleccionan sugerencias de confianza alta. Revisa media/baja antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Generando sugerencias…</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">No se pudieron generar sugerencias automáticas.</p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setReloadKey((k) => k + 1)
                }}
                className="text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Reintentar
              </button>
            </div>
          ) : filas.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No hay ítems pendientes de clave SAT en las órdenes seleccionadas.
            </p>
          ) : (
            <ModuleSurface className="overflow-x-auto">
              <Table className="w-full text-sm text-left">
                <TableHeader className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
                  <TableRow>
                    <TableHead className="px-3 py-2 w-10">✓</TableHead>
                    <TableHead className="px-3 py-2">Proveedor</TableHead>
                    <TableHead className="px-3 py-2">Descripción (EN)</TableHead>
                    <TableHead className="px-3 py-2 w-28">Clave SAT</TableHead>
                    <TableHead className="px-3 py-2">Descripción SAT</TableHead>
                    <TableHead className="px-3 py-2 w-20">Conf.</TableHead>
                    <TableHead className="px-3 py-2">Motivo</TableHead>
                    <TableHead className="px-3 py-2 w-36">Buscar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filas.map((fila, index) => (
                    <Fragment key={`${fila.ordenId}-${fila.itemIndex}`}>
                      <TableRow className="hover:bg-muted">
                        <TableCell className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={fila.aplicar}
                            onChange={(e) => actualizarFila(index, { aplicar: e.target.checked })}
                            className="rounded border-input text-primary"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fila.ordenProveedor}</TableCell>
                        <TableCell className="px-3 py-2 text-foreground max-w-[200px]">
                          <div className="truncate" title={fila.descripcion}>
                            {fila.descripcion}
                          </div>
                          {necesitaAdvertencia(fila) && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="h-3 w-3" />
                              Revisar
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <input
                            value={fila.claveProdServ}
                            onChange={(e) => {
                              actualizarFila(index, {
                                claveProdServ: e.target.value,
                                fuente: 'manual',
                              })
                            }}
                            placeholder="8 dígitos"
                            className="w-full rounded border border-input bg-card px-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground text-xs max-w-[180px] truncate" title={fila.descripcionSat ?? ''}>
                          {fila.descripcionSat ?? '—'}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${confianzaClase(fila.confianza)}`}>
                            {fila.confianza}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground max-w-[160px]">
                          <div className="truncate" title={fila.motivo}>
                            {fila.motivo}
                          </div>
                          {fila.alternativas.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                actualizarFila(index, { mostrarAlternativas: !fila.mostrarAlternativas })
                              }
                              className="mt-1 flex items-center gap-0.5 text-primary hover:text-primary/80 text-[10px] font-semibold"
                            >
                              {fila.mostrarAlternativas ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {fila.alternativas.length} alternativa(s)
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                              e.preventDefault()
                              const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement
                              void buscarClaveInline(index, input.value)
                            }}
                          >
                            <input
                              name="q"
                              key={`q-${fila.terminosBusqueda || fila.descripcion}`}
                              placeholder="Buscar…"
                              defaultValue={fila.terminosBusqueda || fila.descripcion.slice(0, 40)}
                              className="flex-1 min-w-0 rounded border border-input bg-card px-1.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={fila.buscando}
                              className="p-1 text-primary hover:bg-muted rounded disabled:opacity-50"
                              title="Buscar en catálogo"
                            >
                              {fila.buscando ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Search className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </form>
                        </TableCell>
                      </TableRow>
                      {fila.mostrarAlternativas && fila.alternativas.length > 0 && (
                        <TableRow className="bg-sky-50/50">
                          <TableCell colSpan={8} className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {fila.alternativas.map((alt) => (
                                <button
                                  key={alt.clave}
                                  type="button"
                                  onClick={() => aplicarAlternativa(index, alt)}
                                  className="text-left rounded border border-sky-200 bg-card px-2 py-1 text-xs hover:border-sky-400 hover:bg-sky-50"
                                >
                                  <span className="font-mono font-semibold text-sky-800">{alt.clave}</span>
                                  <span className="text-muted-foreground ml-1.5">{alt.descripcionSat}</span>
                                </button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </ModuleSurface>
          )}
        </div>

        <DialogFooter className="justify-between border-t border-border bg-muted/30 px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {filasConClave} de {filas.length} filas listas para aplicar
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAplicar()}
              disabled={saving || loading || filasConClave === 0}
            >
              {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}
              Aplicar seleccionadas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
