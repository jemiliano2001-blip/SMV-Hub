'use client'

/**
 * Vinculación histórica de proveedores (super-admin).
 *
 * UI para el backend que ya existía en /api/proveedores/vinculacion y que nunca tuvo pantalla
 * (por eso McMaster tenía 42 órdenes sin proveedorId aunque empataba exacto — B0.2). Flujo:
 *   Analizar → resumen + fantasmas → Aplicar automáticas (exactos y alias) → por fantasma:
 *   vincular a la sugerencia (aprende alias), elegir otro, o dar de alta (marketplace prellenado).
 * Cada acción queda auditada por la ruta.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Link2, Plus, RefreshCw, Search, Store } from 'lucide-react'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { obtenerProveedores } from '@/lib/proveedores'
import {
  aplicarVinculacionesAutomaticas,
  darDeAltaYVincular,
  previsualizarVinculacionHistorica,
  vincularProveedorManual,
  type PrevisualizacionVinculacion,
  type ProveedorFantasma,
  type ResultadoBackfill,
} from '@/lib/proveedores-vinculacion'
import type { Proveedor } from '@/lib/schemas'

type Coleccion = 'ordenes' | 'cotizaciones'

function coleccionDe(f: ProveedorFantasma): Coleccion {
  return f.origen === 'orden' ? 'ordenes' : 'cotizaciones'
}

function ResumenColeccion({ titulo, r }: { titulo: string; r: ResultadoBackfill }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs">
      <p className="font-bold text-foreground mb-1">{titulo}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
        <span>Revisados</span>
        <span className="text-right font-mono text-foreground">{r.revisados}</span>
        <span>Ya vinculados</span>
        <span className="text-right font-mono text-foreground">{r.yaTenianId}</span>
        <span>Exactos por aplicar</span>
        <span className="text-right font-mono text-emerald-700">{r.vinculados}</span>
        <span>Sin match (fantasmas)</span>
        <span className="text-right font-mono text-amber-700">{r.sinMatch}</span>
        {typeof r.ignoradosInternos === 'number' && r.ignoradosInternos > 0 && (
          <>
            <span>Internos ignorados</span>
            <span className="text-right font-mono text-foreground">{r.ignoradosInternos}</span>
          </>
        )}
      </div>
    </div>
  )
}

function FilaFantasma({
  fantasma,
  catalogo,
  ocupado,
  onVincular,
  onAlta,
}: {
  fantasma: ProveedorFantasma
  catalogo: Proveedor[]
  ocupado: boolean
  onVincular: (f: ProveedorFantasma, proveedorId: string, aprenderAlias: boolean) => Promise<void>
  onAlta: (f: ProveedorFantasma, nombre: string, mercado: 'usa' | 'mexico', esMarketplace: boolean) => Promise<void>
}) {
  const [modo, setModo] = useState<'idle' | 'otro' | 'alta'>('idle')
  const [nombreAlta, setNombreAlta] = useState(fantasma.nombreLibre)
  const [mercadoAlta, setMercadoAlta] = useState<'usa' | 'mexico'>(fantasma.origen === 'orden' ? 'usa' : 'mexico')
  const [marketplaceAlta, setMarketplaceAlta] = useState(fantasma.marketplaceProbable)
  const sugerido = fantasma.sugerenciaCatalogo

  return (
    <TableRow>
      <TableCell className="px-3 py-2 font-medium text-foreground max-w-[220px]">
        <span className="block truncate" title={fantasma.nombreLibre}>{fantasma.nombreLibre}</span>
        {fantasma.marketplaceProbable && (
          <Badge variant="secondary" className="mt-1 text-[10px]">
            <Store className="h-3 w-3" /> marketplace
          </Badge>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 text-xs text-muted-foreground">{fantasma.origen === 'orden' ? 'Órdenes' : 'Cotizaciones'}</TableCell>
      <TableCell className="px-3 py-2 text-right font-mono text-xs">{fantasma.cantidadDocs}</TableCell>
      <TableCell className="px-3 py-2 text-xs">
        {sugerido ? <span className="text-foreground">{sugerido.nombre}</span> : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="px-3 py-2">
        {modo === 'idle' && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {sugerido && (
              <Button type="button" size="xs" disabled={ocupado} onClick={() => void onVincular(fantasma, sugerido.id, true)}>
                <Check /> Vincular a sugerido
              </Button>
            )}
            <Button type="button" variant="outline" size="xs" disabled={ocupado} onClick={() => setModo('otro')}>
              <Link2 /> Elegir…
            </Button>
            <Button type="button" variant="outline" size="xs" disabled={ocupado} onClick={() => setModo('alta')}>
              <Plus /> Dar de alta
            </Button>
          </div>
        )}
        {modo === 'otro' && (
          <div className="flex flex-wrap justify-end items-center gap-1.5">
            <select
              className="h-7 max-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
              defaultValue=""
              disabled={ocupado}
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                void onVincular(fantasma, id, true).finally(() => setModo('idle'))
              }}
            >
              <option value="">Elige un proveedor…</option>
              {catalogo.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <Button type="button" variant="ghost" size="xs" disabled={ocupado} onClick={() => setModo('idle')}>Cancelar</Button>
          </div>
        )}
        {modo === 'alta' && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap justify-end gap-1.5">
              <input
                className="h-7 w-[200px] rounded-md border border-input bg-background px-2 text-xs"
                value={nombreAlta}
                onChange={(e) => setNombreAlta(e.target.value)}
                placeholder="Nombre en el catálogo"
                disabled={ocupado}
              />
              <select
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                value={mercadoAlta}
                onChange={(e) => setMercadoAlta(e.target.value === 'mexico' ? 'mexico' : 'usa')}
                disabled={ocupado}
              >
                <option value="usa">USA</option>
                <option value="mexico">México</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" checked={marketplaceAlta} onChange={(e) => setMarketplaceAlta(e.target.checked)} disabled={ocupado} />
              Marketplace (canal, no vendedor)
            </label>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="xs"
                disabled={ocupado || !nombreAlta.trim()}
                onClick={() => void onAlta(fantasma, nombreAlta.trim(), mercadoAlta, marketplaceAlta).finally(() => setModo('idle'))}
              >
                <Check /> Dar de alta y vincular
              </Button>
              <Button type="button" variant="ghost" size="xs" disabled={ocupado} onClick={() => setModo('idle')}>Cancelar</Button>
            </div>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function PanelVinculacionHistorica() {
  const confirmar = useConfirmDialog()
  const [catalogo, setCatalogo] = useState<Proveedor[]>([])
  const [analisis, setAnalisis] = useState<PrevisualizacionVinculacion | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  const cargarCatalogo = useCallback(
    () =>
      obtenerProveedores()
        .then(setCatalogo)
        .catch((err) => console.error('[vinculacion] no se pudo cargar el catálogo:', err)),
    []
  )

  useEffect(() => {
    cargarCatalogo()
  }, [cargarCatalogo])

  async function analizar() {
    setAnalizando(true)
    setError(null)
    setMensaje(null)
    try {
      setAnalisis(await previsualizarVinculacionHistorica())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar el histórico.')
    } finally {
      setAnalizando(false)
    }
  }

  async function aplicarAutomaticas() {
    if (!analisis) return
    const total = analisis.ordenes.vinculados + analisis.cotizaciones.vinculados
    if (total === 0) {
      setMensaje('No hay vínculos exactos pendientes.')
      return
    }
    const ok = await confirmar({
      title: 'Aplicar vínculos exactos',
      description: `Se vincularán ${analisis.ordenes.vinculados} órdenes y ${analisis.cotizaciones.vinculados} cotizaciones cuyo proveedor coincide exactamente (nombre o alias) con el catálogo. Queda auditado.`,
      confirmLabel: 'Aplicar',
    })
    if (!ok) return
    setOcupado(true)
    setError(null)
    try {
      const r = await aplicarVinculacionesAutomaticas()
      setMensaje(`Vinculadas ${r.ordenes.vinculados} órdenes y ${r.cotizaciones.vinculados} cotizaciones.`)
      await analizar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron aplicar los vínculos.')
    } finally {
      setOcupado(false)
    }
  }

  async function vincular(f: ProveedorFantasma, proveedorId: string, aprenderAlias: boolean) {
    setOcupado(true)
    setError(null)
    try {
      const r = await vincularProveedorManual(coleccionDe(f), f.idsDocs, proveedorId, {
        nombreLibre: f.nombreLibre,
        guardarAlias: aprenderAlias,
      })
      const nombre = catalogo.find((p) => p.id === proveedorId)?.nombre ?? proveedorId
      setMensaje(
        `"${f.nombreLibre}" (${f.idsDocs.length} de ${f.cantidadDocs}) → ${nombre}.${r.aliasAprendido ? ' Alias aprendido.' : ''}${
          f.cantidadDocs > f.idsDocs.length ? ' Vuelve a analizar para vincular el resto.' : ''
        }`
      )
      await Promise.all([analizar(), cargarCatalogo()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular.')
    } finally {
      setOcupado(false)
    }
  }

  async function darDeAlta(f: ProveedorFantasma, nombre: string, mercado: 'usa' | 'mexico', esMarketplace: boolean) {
    setOcupado(true)
    setError(null)
    try {
      await darDeAltaYVincular({
        coleccion: coleccionDe(f),
        idsDocs: f.idsDocs,
        nombre,
        mercado,
        esMarketplace,
        nombreLibre: f.nombreLibre,
      })
      setMensaje(`Alta de "${nombre}" (${mercado}${esMarketplace ? ', marketplace' : ''}) y ${f.idsDocs.length} registro(s) vinculados.`)
      await Promise.all([analizar(), cargarCatalogo()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de alta.')
    } finally {
      setOcupado(false)
    }
  }

  const fantasmasVisibles = useMemo(() => {
    if (!analisis) return []
    const q = filtro.trim().toLowerCase()
    return q ? analisis.fantasmas.filter((f) => f.nombreLibre.toLowerCase().includes(q)) : analisis.fantasmas
  }, [analisis, filtro])

  const exactosPendientes = analisis ? analisis.ordenes.vinculados + analisis.cotizaciones.vinculados : 0

  return (
    <ModuleSurface id="panel-vinculacion-historica" className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Vinculación histórica de proveedores
          </h3>
          <p className="text-xs text-muted-foreground">
            Liga órdenes y cotizaciones a su proveedor del catálogo. Los exactos (nombre o alias) se aplican
            en bloque; los demás se revisan uno por uno y el nombre aprendido queda como alias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={analizando || ocupado} onClick={() => void analizar()}>
            <RefreshCw className={analizando ? 'animate-spin' : ''} /> {analisis ? 'Volver a analizar' : 'Analizar'}
          </Button>
          <Button type="button" size="sm" disabled={!analisis || ocupado || exactosPendientes === 0} onClick={() => void aplicarAutomaticas()}>
            <Check /> Aplicar exactos {analisis ? `(${exactosPendientes})` : ''}
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {mensaje && !error && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">{mensaje}</p>
      )}

      {analisis && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResumenColeccion titulo="Órdenes" r={analisis.ordenes} />
            <ResumenColeccion titulo="Cotizaciones" r={analisis.cotizaciones} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-foreground">
              Fantasmas: {analisis.fantasmas.length} nombres sin match
              <span className="font-normal text-muted-foreground"> · cada acción vincula hasta 20 documentos por nombre</span>
            </p>
            <label className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-8 w-[220px] rounded-md border border-input bg-background pl-7 pr-2 text-xs"
                placeholder="Filtrar por nombre"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2">Nombre en los documentos</TableHead>
                  <TableHead className="px-3 py-2">Origen</TableHead>
                  <TableHead className="px-3 py-2 text-right">Docs</TableHead>
                  <TableHead className="px-3 py-2">Sugerencia</TableHead>
                  <TableHead className="px-3 py-2 text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fantasmasVisibles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {analisis.fantasmas.length === 0 ? 'Sin fantasmas: todo el histórico está vinculado o es interno.' : 'Nada coincide con el filtro.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  fantasmasVisibles.map((f) => (
                    <FilaFantasma
                      key={`${f.origen}:${f.nombreLibre}`}
                      fantasma={f}
                      catalogo={catalogo}
                      ocupado={ocupado}
                      onVincular={vincular}
                      onAlta={darDeAlta}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!analisis && !analizando && (
        <p className="text-xs text-muted-foreground">Pulsa <span className="font-semibold">Analizar</span> para revisar el histórico. No escribe nada hasta que apliques una acción.</p>
      )}
    </ModuleSurface>
  )
}
