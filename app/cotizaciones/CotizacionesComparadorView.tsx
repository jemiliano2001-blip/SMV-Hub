'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingDown,
  Sparkles,
  Search,
  ShoppingCart,
  PlusCircle,
  Copy,
  ExternalLink,
  Clock,
  Building2,
  AlertTriangle,
  Layers,
  Edit2,
} from 'lucide-react'
import type { Cotizacion } from '@/lib/schemas'
import { formatPrecio, formatFecha } from '@/lib/format'
import { generarLlavePieza } from '@/lib/pieza-matching'
import { toast } from 'sonner'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface GrupoComparativa {
  llave: string
  numeroParte: string | null
  descripcion: string
  items: Cotizacion[]
  proveedoresUnicos: number
  mejorOferta: Cotizacion | null
  peorOferta: Cotizacion | null
  ahorroPorcentual: number | null
  ahorroMonto: number | null
  entregaMasRapida: Cotizacion | null
  masReciente: Cotizacion | null
}

interface CotizacionesComparadorViewProps {
  cotizaciones: Cotizacion[]
  onEditar?: (c: Cotizacion) => void
}

function calcularDiasDesde(fechaIso: string | null | undefined): number {
  if (!fechaIso) return 999
  const f = new Date(fechaIso)
  if (isNaN(f.getTime())) return 999
  const hoy = new Date()
  const diffMs = hoy.getTime() - f.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function BadgeVigencia({ fecha }: { fecha: string | null | undefined }) {
  if (!fecha) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Sin fecha
      </span>
    )
  }

  const dias = calcularDiasDesde(fecha)

  if (dias <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Vigente ({dias}d)
      </span>
    )
  }

  if (dias <= 60) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Media ({dias}d)
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300">
      <AlertTriangle className="h-2.5 w-2.5" />
      Re-cotizar ({dias}d)
    </span>
  )
}

export default function CotizacionesComparadorView({
  cotizaciones,
  onEditar,
}: CotizacionesComparadorViewProps) {

  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [soloMultiproveedor, setSoloMultiproveedor] = useState(true)
  const [filtroVigencia, setFiltroVigencia] = useState<'todas' | 'vigentes' | 'por_recotizar'>('todas')

  // Agrupación de cotizaciones por llave canónica de pieza
  const grupos: GrupoComparativa[] = useMemo(() => {
    const mapa = new Map<string, Cotizacion[]>()

    cotizaciones.forEach((c) => {
      const llave = c.llavePieza || generarLlavePieza(c.numeroParte, c.descripcion)
      if (!mapa.has(llave)) {
        mapa.set(llave, [])
      }
      mapa.get(llave)!.push(c)
    })

    const listaGrupos: GrupoComparativa[] = []

    mapa.forEach((items, llave) => {
      if (items.length === 0) return

      // Ordenar por precio unitario ascendente (los nulos al final)
      const ordenadasPorPrecio = [...items].sort((a, b) => {
        if (a.precioUnitario == null) return 1
        if (b.precioUnitario == null) return -1
        return a.precioUnitario - b.precioUnitario
      })

      // Ordenar por fecha descendente
      const ordenadasPorFecha = [...items].sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() || 0 : 0
        const db = b.fecha ? new Date(b.fecha).getTime() || 0 : 0
        return db - da
      })


      const itemsConPrecio = ordenadasPorPrecio.filter((i) => i.precioUnitario != null && i.precioUnitario > 0)
      const mejorOferta = itemsConPrecio.length > 0 ? itemsConPrecio[0] : null
      const peorOferta = itemsConPrecio.length > 1 ? itemsConPrecio[itemsConPrecio.length - 1] : null

      let ahorroPorcentual: number | null = null
      let ahorroMonto: number | null = null
      if (mejorOferta && peorOferta && peorOferta.precioUnitario && mejorOferta.precioUnitario) {
        // Si ambas son en la misma moneda o referencial
        if (peorOferta.moneda === mejorOferta.moneda) {
          const diff = peorOferta.precioUnitario - mejorOferta.precioUnitario
          if (diff > 0) {
            ahorroMonto = diff
            ahorroPorcentual = Math.round((diff / peorOferta.precioUnitario) * 100)
          }
        }
      }

      // Proveedores únicos
      const proveedoresSet = new Set(items.map((i) => i.proveedor.trim().toLowerCase()))

      // Identificar pieza representativa
      const itemConSku = items.find((i) => i.numeroParte) || items[0]

      listaGrupos.push({
        llave,
        numeroParte: itemConSku.numeroParte || null,
        descripcion: itemConSku.descripcion,
        items: ordenadasPorPrecio,
        proveedoresUnicos: proveedoresSet.size,
        mejorOferta,
        peorOferta,
        ahorroPorcentual,
        ahorroMonto,
        entregaMasRapida: items.find((i) => i.diasHabiles && /1|2|3|inmed|stock/i.test(i.diasHabiles)) || null,
        masReciente: ordenadasPorFecha[0] || null,
      })
    })

    // Ordenar primero las que tienen más comparabilidad y mayor ahorro
    return listaGrupos.sort((a, b) => {
      if (a.items.length !== b.items.length) {
        return b.items.length - a.items.length
      }
      return (b.ahorroPorcentual ?? 0) - (a.ahorroPorcentual ?? 0)
    })
  }, [cotizaciones])

  // Filtrado de grupos
  const gruposFiltrados = useMemo(() => {
    return grupos.filter((g) => {
      if (soloMultiproveedor && g.items.length < 2) return false

      if (filtroVigencia === 'vigentes') {
        const dias = g.masReciente ? calcularDiasDesde(g.masReciente.fecha) : 999
        if (dias > 60) return false
      } else if (filtroVigencia === 'por_recotizar') {
        const dias = g.masReciente ? calcularDiasDesde(g.masReciente.fecha) : 999
        if (dias <= 60) return false
      }

      if (busqueda.trim()) {
        const term = busqueda.toLowerCase().trim()
        const matchSku = g.numeroParte?.toLowerCase().includes(term)
        const matchDesc = g.descripcion.toLowerCase().includes(term)
        const matchProv = g.items.some((i) => i.proveedor.toLowerCase().includes(term))
        if (!matchSku && !matchDesc && !matchProv) return false
      }

      return true
    })
  }, [grupos, soloMultiproveedor, filtroVigencia, busqueda])

  // Handlers de conversión
  const handleComprarUsa = (c: Cotizacion) => {
    const params = new URLSearchParams()
    if (c.proveedor) params.set('proveedor', c.proveedor)
    if (c.numeroParte) params.set('numeroParte', c.numeroParte)
    if (c.descripcion) params.set('descripcion', c.descripcion)
    if (c.precioUnitario !== null) params.set('precioUnitario', String(c.precioUnitario))
    if (c.cantidad !== null) params.set('cantidad', String(c.cantidad))
    if (c.total !== null) params.set('total', String(c.total))
    if (c.link) params.set('linkProveedor', c.link)
    if (c.solicitante) params.set('requisitor', c.solicitante)
    params.set('moneda', c.moneda || 'USD')
    params.set('cotizacionId', c.id)

    router.push(`/nueva-compra?${params.toString()}`)
  }

  const handleCrearOdoo = (c: Cotizacion) => {
    const params = new URLSearchParams()
    if (c.proveedor) params.set('proveedor', c.proveedor)
    if (c.numeroParte) params.set('numeroParte', c.numeroParte)
    if (c.descripcion) params.set('descripcion', c.descripcion)
    if (c.precioUnitario !== null) params.set('precioUnitario', String(c.precioUnitario))
    if (c.cantidad !== null) params.set('cantidad', String(c.cantidad))
    params.set('moneda', c.moneda || (c.ubicacion === 'USA' ? 'USD' : 'MXN'))
    if (c.numeroParte) params.set('referencia', c.numeroParte)

    router.push(`/compras-odoo?${params.toString()}`)
  }

  const handleCopiarWhatsApp = (c: Cotizacion) => {
    const lineas = [
      `📋 *COTIZACIÓN SMV*`,
      c.numeroParte ? `*No. Parte:* ${c.numeroParte}` : null,
      `*Descripción:* ${c.descripcion}`,
      `*Proveedor:* ${c.proveedor} (${c.ubicacion})`,
      c.cantidad ? `*Cantidad:* ${c.cantidad}` : null,
      c.precioUnitario !== null ? `*P. Unitario:* ${formatPrecio(c.precioUnitario, c.moneda)}` : null,
      c.total !== null ? `*Total:* ${formatPrecio(c.total, c.moneda)}` : null,
      c.diasHabiles ? `*Entrega:* ${c.diasHabiles}` : null,
      c.link ? `*Link:* ${c.link}` : null,
      c.notas ? `*Notas:* ${c.notas}` : null,
    ]
    const texto = lineas.filter(Boolean).join('\n')

    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success('Cotización copiada al portapapeles en formato WhatsApp'))
      .catch(() => toast.error('No se pudo copiar al portapapeles'))
  }

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Búsqueda */}
      <ModuleSurface className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por SKU, descripción de pieza o proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant={soloMultiproveedor ? 'default' : 'outline'}
              onClick={() => setSoloMultiproveedor(!soloMultiproveedor)}
              className="text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              Solo 2+ cotizaciones
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {grupos.filter((g) => g.items.length >= 2).length}
              </Badge>
            </Button>

            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFiltroVigencia('todas')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filtroVigencia === 'todas'
                    ? 'bg-background font-semibold text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroVigencia('vigentes')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filtroVigencia === 'vigentes'
                    ? 'bg-background font-semibold text-emerald-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Vigentes (&lt;60d)
              </button>
              <button
                type="button"
                onClick={() => setFiltroVigencia('por_recotizar')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  filtroVigencia === 'por_recotizar'
                    ? 'bg-background font-semibold text-rose-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Por re-cotizar
              </button>
            </div>
          </div>
        </div>
      </ModuleSurface>

      {/* Lista de Grupos Comparativos */}
      {gruposFiltrados.length === 0 ? (
        <ModuleEmptyState
          icon={Layers}
          title="No hay comparativas con los filtros seleccionados"
          description={
            soloMultiproveedor
              ? 'Actualmente no hay piezas con 2 o más cotizaciones registradas para comparar. Desactiva el filtro "Solo 2+ cotizaciones" para ver todas las piezas.'
              : 'Intenta ajustar los términos de búsqueda o registrar nuevas cotizaciones con IA.'
          }
        />
      ) : (
        <div className="space-y-4">
          {gruposFiltrados.map((grupo) => {
            return (
              <ModuleSurface
                key={grupo.llave}
                className="overflow-hidden border border-border/80 shadow-sm transition-all hover:border-primary/40"
              >
                {/* Cabecera del Grupo (Pieza) */}
                <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {grupo.numeroParte && (
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {grupo.numeroParte}
                          </span>
                        )}
                        <span className="text-xs font-medium text-muted-foreground">
                          {grupo.items.length}{' '}
                          {grupo.items.length === 1 ? 'cotización' : 'cotizaciones'} registradas
                          ({grupo.proveedoresUnicos} {grupo.proveedoresUnicos === 1 ? 'proveedor' : 'proveedores'})
                        </span>
                        {grupo.masReciente && (
                          <BadgeVigencia fecha={grupo.masReciente.fecha} />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {grupo.descripcion}
                      </h3>
                    </div>

                    {/* Resumen de Ahorro */}
                    {grupo.ahorroPorcentual && grupo.ahorroPorcentual > 0 && (
                      <div className="flex items-center gap-2 self-start sm:self-auto rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 text-emerald-800 dark:text-emerald-300">
                        <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold">
                            Hasta {grupo.ahorroPorcentual}% de ahorro
                          </span>
                          {grupo.ahorroMonto && grupo.mejorOferta && (
                            <span className="block text-[11px] opacity-80">
                              Ahorro de {formatPrecio(grupo.ahorroMonto, grupo.mejorOferta.moneda)} por pieza
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid de Ofertas por Proveedor */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grupo.items.map((cot) => {
                    const esMejorPrecio =
                      grupo.mejorOferta?.id === cot.id && grupo.items.length > 1 && cot.precioUnitario != null

                    return (
                      <div
                        key={cot.id}
                        className={`relative rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                          esMejorPrecio
                            ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm ring-1 ring-emerald-500/20'
                            : 'border-border/70 bg-card hover:border-border'
                        }`}
                      >
                        {/* Badge de Ganador */}
                        {esMejorPrecio && (
                          <div className="absolute -top-2.5 right-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                              <Sparkles className="h-2.5 w-2.5" />
                              Mejor Precio
                            </span>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                                  {cot.proveedor}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span
                                  className={`rounded px-1.5 py-0.2 font-semibold text-[10px] ${
                                    cot.ubicacion === 'USA'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                  }`}
                                >
                                  {cot.ubicacion === 'USA' ? 'EUA' : 'MX'}
                                </span>
                                <span>{formatFecha(cot.fecha)}</span>
                              </div>
                            </div>

                            <BadgeVigencia fecha={cot.fecha} />
                          </div>

                          {/* Precio y Condiciones */}
                          <div className="pt-2 border-t border-border/50">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[11px] text-muted-foreground">P. Unitario:</span>
                              <span
                                className={`font-mono text-base font-bold ${
                                  esMejorPrecio
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-foreground'
                                }`}
                              >
                                {formatPrecio(cot.precioUnitario, cot.moneda)}
                              </span>
                            </div>

                            {cot.cantidad && cot.cantidad > 1 && (
                              <div className="flex items-baseline justify-between text-xs text-muted-foreground mt-0.5">
                                <span>Total ({cot.cantidad} pzs):</span>
                                <span className="font-mono font-semibold text-foreground">
                                  {formatPrecio(cot.total, cot.moneda)}
                                </span>
                              </div>
                            )}

                            {cot.diasHabiles && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                                <Clock className="h-3 w-3 text-sky-600" />
                                <span>Entrega: <strong className="text-foreground">{cot.diasHabiles}</strong></span>
                              </div>
                            )}

                            {cot.solicitante && (
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Solicitó: <span className="text-foreground">{cot.solicitante}</span>
                              </div>
                            )}

                            {cot.notas && (
                              <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2" title={cot.notas}>
                                &ldquo;{cot.notas}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Barra de Acciones en 1 Clic */}
                        <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={esMejorPrecio ? 'default' : 'outline'}
                              className="h-7 text-xs px-2 gap-1"
                              onClick={() => handleComprarUsa(cot)}
                              title="Comprar en USA (/nueva-compra)"
                            >
                              <ShoppingCart className="h-3 w-3" />
                              Comprar USA
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1"
                              onClick={() => handleCrearOdoo(cot)}
                              title="Crear RFQ en Odoo (/compras-odoo)"
                            >
                              <PlusCircle className="h-3 w-3 text-indigo-600" />
                              Odoo
                            </Button>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopiarWhatsApp(cot)}
                              title="Copiar WhatsApp"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {cot.link && /^https?:\/\//i.test(cot.link) && (
                              <a
                                href={cot.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Abrir enlace del proveedor"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {onEditar && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => onEditar(cot)}
                                title="Editar cotización"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ModuleSurface>
            )
          })}
        </div>
      )}
    </div>
  )
}
