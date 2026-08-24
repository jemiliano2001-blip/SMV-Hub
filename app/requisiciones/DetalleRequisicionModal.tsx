'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fechaHoyLocal } from '@/lib/format'
import {
  CheckCircle2,
  Zap,
  Award,
  Sparkles,
  Plus,
  ShieldCheck,
  Send,
  AlertTriangle,
  DollarSign,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import ModuleSurface from '@/components/layout/ModuleSurface'
import type { Requisicion, CotizacionRequisicion } from '@/lib/schemas'
import { useProveedores } from '@/lib/hooks/useProveedores'
import { useProveedoresInteligencia } from '@/lib/hooks/useProveedoresInteligencia'
import SeccionRecomendacionInteligente from './SeccionRecomendacionInteligente'
import { obtenerTipoCambio, TIPO_CAMBIO_DEFAULT_USD_MXN, aUSD } from '@/lib/tipo-cambio'
import {
  calcularConfiabilidadLeadTime,
  mapaConfiabilidad,
  listarTodasCotizacionesRequisicion,
  evaluarAlertaPrecio,
  fusionarPuntosPrecio,
  resumirPreciosPorPiezaProveedor,
} from '@/lib/proveedores-inteligencia-cruzada'
import { generarLlavePieza } from '@/lib/pieza-matching'
import { listarCotizaciones } from '@/lib/cotizaciones'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  abierto: boolean
  onClose: () => void
  requisicion: Requisicion | null
  obtenerCotizaciones: (reqId: string) => Promise<CotizacionRequisicion[]>
  agregarCotizacion: (payload: Omit<CotizacionRequisicion, 'id' | 'creadoEn'>) => Promise<CotizacionRequisicion>
  seleccionarGanador: (reqId: string, cotId: string, motivo: string) => Promise<void>
  generarOC: (
    req: Requisicion,
    cot: CotizacionRequisicion,
    condiciones?: string,
    leadTime?: string,
    notas?: string
  ) => Promise<{ ordenId: string; folioOC: string }>
}

export default function DetalleRequisicionModal({
  abierto,
  onClose,
  requisicion,
  obtenerCotizaciones,
  agregarCotizacion,
  seleccionarGanador,
  generarOC,
}: Props) {
  const { todosProveedores } = useProveedores()
  const { evaluaciones, todasCompras } = useProveedoresInteligencia({
    habilitado: true,
  })
  const [cotizaciones, setCotizaciones] = useState<CotizacionRequisicion[]>([])
  const [cargandoCot, setCargandoCot] = useState(false)
  const [errorCot, setErrorCot] = useState<string | null>(null)

  // Sub-modales y formularios
  const [mostrarFormCot, setMostrarFormCot] = useState(false)
  const [provCotId, setProvCotId] = useState('')
  const [monedaCot, setMonedaCot] = useState<'USD' | 'MXN'>('USD')
  const [leadTimeCot, setLeadTimeCot] = useState(3)
  const [condicionesCot, setCondicionesCot] = useState('Net 30')
  // ponytail: el form de cotización ya no captura envío; default fijo
  const costoEnvioCot = 15
  const [subtotalCot, setSubtotalCot] = useState(500)
  const [obsCot, setObsCot] = useState('')

  // Selección de ganador
  const [cotizacionSeleccionando, setCotizacionSeleccionando] = useState<CotizacionRequisicion | null>(null)
  const [motivoGanador, setMotivoGanador] = useState('')
  const [procesandoGanador, setProcesandoGanador] = useState(false)

  // Generación de OC
  const [generandoOCState, setGenerandoOCState] = useState(false)
  const [ocGeneradaExito, setOcGeneradaExito] = useState<{ ordenId: string; folioOC: string } | null>(null)

  const [tipoCambioUsdMxn, setTipoCambioUsdMxn] = useState(TIPO_CAMBIO_DEFAULT_USD_MXN)
  const [confiabilidadMap, setConfiabilidadMap] = useState<Record<string, number>>({})
  const [alertaPrecioMsg, setAlertaPrecioMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    void obtenerTipoCambio().then((fx) => setTipoCambioUsdMxn(fx.usdToMxn))
    void Promise.all([listarTodasCotizacionesRequisicion(), listarCotizaciones()])
      .then(([todasReq, historico]) => {
        const conf = calcularConfiabilidadLeadTime(todasCompras, todasReq)
        setConfiabilidadMap(mapaConfiabilidad(conf))
        // Precalcular resumen de precios para alertas (se usa al guardar cotización)
        void historico
      })
      .catch(() => {
        /* silencioso */
      })
  }, [abierto, todasCompras])

  const cargarCotizaciones = useCallback((requisicionId: string) => {
    setCargandoCot(true)
    setErrorCot(null)
    obtenerCotizaciones(requisicionId)
      .then((res) => setCotizaciones(res))
      .catch((err) => {
        console.error(err)
        setErrorCot('No se pudieron cargar las cotizaciones. Intenta de nuevo.')
      })
      .finally(() => setCargandoCot(false))
  }, [obtenerCotizaciones])

  useEffect(() => {
    if (requisicion && abierto) {
      // Carga al abrir el modal: spinner inmediato intencional, no una cascada.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarCotizaciones(requisicion.id)
    }
  }, [requisicion, abierto, cargarCotizaciones])

  const cotizacionGanadora = useMemo(() => {
    return cotizaciones.find((c) => c.ganadora) || null
  }, [cotizaciones])

  // Ranking inteligente de cotizaciones (precios normalizados a USD)
  const rankingCotizaciones = useMemo(() => {
    if (cotizaciones.length === 0) return []
    const preciosUSD = cotizaciones
      .filter((c) => c.total > 0)
      .map((c) => aUSD(c.total, c.moneda, tipoCambioUsdMxn))
    const minPrecio = preciosUSD.length > 0 ? Math.min(...preciosUSD) : 0

    const leadTimes = cotizaciones.map((c) => c.leadTimeDias).filter((lt) => lt > 0)
    const minLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : 0

    return cotizaciones.map((c) => {
      const totalUSD = aUSD(c.total, c.moneda, tipoCambioUsdMxn)
      const esMejorPrecio = totalUSD === minPrecio && minPrecio > 0
      const esMasRapido = c.leadTimeDias === minLeadTime && minLeadTime > 0
      const esMejorBalance = esMejorPrecio || (esMasRapido && cotizaciones.length <= 2)

      return {
        ...c,
        esMejorBalance,
        esMejorPrecio,
        esMasRapido,
      }
    })
  }, [cotizaciones, tipoCambioUsdMxn])

  if (!requisicion) return null

  // Timeline de estatus
  const pasosTimeline = [
    { key: 'borrador', label: '1. Borrador', desc: 'Creada por solicitante' },
    { key: 'enviada', label: '2. Enviada', desc: 'Solicitud enviada' },
    { key: 'cotizando', label: '3. Cotizando', desc: 'Cotizaciones en revisión' },
    { key: 'aprobada', label: '4. Aprobada', desc: 'Ganador seleccionado' },
    { key: 'convertida_a_oc', label: '5. OC Generada', desc: 'Orden emitida' },
  ]

  const estatusActualIndex = pasosTimeline.findIndex(
    (p) => p.key === (requisicion.estatusFlujo || (requisicion.estado === 'comprado' ? 'convertida_a_oc' : 'enviada'))
  )

  async function handleGuardarCotizacion(e: React.FormEvent) {
    e.preventDefault()
    if (!provCotId) {
      setAlertaPrecioMsg('Selecciona un proveedor del catálogo antes de guardar.')
      return
    }
    const prov = todosProveedores.find((p) => p.id === provCotId)
    if (!prov) {
      setAlertaPrecioMsg('El proveedor seleccionado no existe en el catálogo.')
      return
    }
    const provNombre = prov.nombre
    const totalCalc = Number(subtotalCot) + Number(costoEnvioCot)

    try {
      // Alerta de precio vs histórico
      try {
        const historico = await listarCotizaciones()
        const todasReq = await listarTodasCotizacionesRequisicion()
        const puntos = fusionarPuntosPrecio(historico, todasCompras, todasReq, tipoCambioUsdMxn)
        const resumen = resumirPreciosPorPiezaProveedor(puntos)
        const primerItem = (requisicion!.items || [])[0]
        if (primerItem) {
          const llave = generarLlavePieza(null, primerItem.descripcion)
          const precioUnit = Number(subtotalCot) / (primerItem.cantidad || 1)
          const alerta = evaluarAlertaPrecio(
            precioUnit,
            monedaCot,
            llave,
            provCotId,
            resumen,
            tipoCambioUsdMxn
          )
          setAlertaPrecioMsg(`${alerta.tipo}: ${alerta.mensaje}`)
        }
      } catch {
        setAlertaPrecioMsg(null)
      }

      const nueva = await agregarCotizacion({
        requisicionId: requisicion!.id,
        proveedorId: provCotId,
        proveedorNombre: provNombre,
        fechaCotizacion: fechaHoyLocal(),
        moneda: monedaCot,
        condicionesPago: condicionesCot,
        leadTimeDias: Number(leadTimeCot),
        costoEnvioUSD: Number(costoEnvioCot),
        subtotal: Number(subtotalCot),
        total: totalCalc,
        observaciones: obsCot,
        itemsCotizados: (requisicion!.items || []).map((it) => ({
          itemId: it.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: subtotalCot / (it.cantidad || 1),
          subtotal: subtotalCot,
          categoria: it.categoria,
        })),
        ganadora: false,
      })
      setCotizaciones((prev) => [...prev, nueva])
      setMostrarFormCot(false)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleConfirmarGanador() {
    if (!cotizacionSeleccionando || !motivoGanador.trim()) return
    setProcesandoGanador(true)
    try {
      await seleccionarGanador(requisicion!.id, cotizacionSeleccionando.id, motivoGanador.trim())
      setCotizacionSeleccionando(null)
      setMotivoGanador('')
      const renovadas = await obtenerCotizaciones(requisicion!.id)
      setCotizaciones(renovadas)
    } catch (err) {
      console.error(err)
    } finally {
      setProcesandoGanador(false)
    }
  }

  async function handleGenerarOCClick() {
    if (!cotizacionGanadora) return
    setGenerandoOCState(true)
    try {
      const res = await generarOC(
        requisicion!,
        cotizacionGanadora,
        cotizacionGanadora.condicionesPago,
        fechaHoyLocal(new Date(Date.now() + cotizacionGanadora.leadTimeDias * 86400000)),
        `Generado automáticamente desde el Comparador de Requisiciones (${requisicion!.folio})`
      )
      setOcGeneradaExito(res)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerandoOCState(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto font-sans p-6">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-black bg-foreground text-background px-2 py-0.5 rounded">
                  {requisicion.folio || `REQ-${requisicion.id.substring(0, 6)}`}
                </span>
                <DialogTitle className="text-base font-bold text-foreground">
                  {requisicion.descripcion}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Solicitado por <span className="font-bold text-foreground">{requisicion.solicitante}</span> · {requisicion.departamento || requisicion.empresa || 'Taller'}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-300">
                Prioridad: {requisicion.prioridadFlujo || requisicion.prioridad || 'Media'}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* STEPPER TIMELINE PROCESO DE COMPRAS */}
          <div className="bg-foreground text-background p-4 rounded-xl shadow-xs">
            <h3 className="text-xs font-bold text-background/60 uppercase tracking-wider mb-3">
              Flujo de Trazabilidad End-to-End
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center text-xs font-sans">
              {pasosTimeline.map((paso, idx) => {
                const alcanzado = idx <= (estatusActualIndex >= 0 ? estatusActualIndex : 1)
                const actual = idx === (estatusActualIndex >= 0 ? estatusActualIndex : 1)
                return (
                  <div key={paso.key} className="space-y-1">
                    <div
                      className={[
                        'mx-auto w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all',
                        actual
                          ? 'bg-amber-400 text-foreground ring-4 ring-amber-400/30 font-black'
                          : alcanzado
                          ? 'bg-emerald-500 text-white'
                          : 'bg-background/15 text-background/50 border border-background/20',
                      ].join(' ')}
                    >
                      {alcanzado ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : idx + 1}
                    </div>
                    <p className={`text-[11px] font-bold ${actual ? 'text-amber-300' : alcanzado ? 'text-background/80' : 'text-background/40'}`}>
                      {paso.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* DETALLES Y JUSTIFICACIÓN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <ModuleSurface className="sm:col-span-2 p-3.5 space-y-1">
              <span className="font-bold text-foreground block uppercase text-[10px] tracking-wider">
                Motivo / Justificación Taller
              </span>
              <p className="text-foreground leading-relaxed font-medium">
                {requisicion.motivoJustificacion || requisicion.nota || 'Sin justificación detallada dada.'}
              </p>
            </ModuleSurface>

            <ModuleSurface className="p-3.5 space-y-1">
              <span className="font-bold text-foreground block uppercase text-[10px] tracking-wider">
                Aprobación de Compra
              </span>
              <p className="text-foreground font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                {requisicion.aprobador || 'Sin asignar'}
              </p>
              <span
                className={`inline-block text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                  requisicion.estatusAprobacion === 'aprobada'
                    ? 'bg-emerald-100 text-emerald-800'
                    : requisicion.estatusAprobacion === 'rechazada'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                Estatus: {requisicion.estatusAprobacion?.toUpperCase() || 'PENDIENTE'}
              </span>
            </ModuleSurface>
          </div>

          {/* DESGLOSE DE ÍTEMS REQUERIDOS */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Ítems y Herramientas Solicitadas ({requisicion.items?.length || 1})
            </h3>
            <ModuleSurface>
              <Table className="w-full text-left text-xs font-sans">
                <TableHeader className="bg-muted text-muted-foreground font-bold text-[10px] uppercase">
                  <TableRow>
                    <TableHead className="px-3 py-2">Descripción</TableHead>
                    <TableHead className="px-3 py-2">Categoría</TableHead>
                    <TableHead className="px-3 py-2">Cantidad</TableHead>
                    <TableHead className="px-3 py-2">Marca / Espec.</TableHead>
                    <TableHead className="px-3 py-2">Proveedor Sugerido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border bg-card">
                  {(requisicion.items && requisicion.items.length > 0
                    ? requisicion.items
                    : [
                        {
                          id: 'it-def',
                          descripcion: requisicion.descripcion,
                          categoria: 'tooling',
                          cantidad: 1,
                          unidad: requisicion.cantidad || 'pza',
                          marcaPreferida: 'Estándar',
                          especificacion: requisicion.parteNumero || 'N/A',
                          proveedorSugeridoNombre: requisicion.tienda || 'Shars Tool',
                        },
                      ]
                  ).map((it, idx) => (
                    <TableRow key={idx} className="hover:bg-muted">
                      <TableCell className="px-3 py-2 font-bold text-foreground">{it.descripcion}</TableCell>
                      <TableCell className="px-3 py-2 uppercase font-mono text-[11px] text-muted-foreground">{it.categoria}</TableCell>
                      <TableCell className="px-3 py-2 font-mono font-bold text-foreground">
                        {it.cantidad} {it.unidad}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground font-mono text-[11px]">
                        {it.marcaPreferida || 'Cualquiera'} {it.especificacion ? `(${it.especificacion})` : ''}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-primary font-bold">
                        {it.proveedorSugeridoNombre || 'Shars Tool / OnlineCarbide'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>

          {/* MATRIZ DE COMPARACIÓN DE COTIZACIONES */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Comparador Multicriterio de Cotizaciones ({cotizaciones.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Compara precio, lead time y scoring histórico de proveedores para seleccionar el mejor postor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarFormCot(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> + Capturar Cotización
              </button>
            </div>

            {/* FORMULARIO RÁPIDO AGREGAR COTIZACIÓN */}
            {mostrarFormCot && (
              <form onSubmit={handleGuardarCotizacion} className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-amber-900 flex items-center gap-1">
                    <Plus className="h-4 w-4 text-amber-700" /> Registrar Cotización de Proveedor
                  </h4>
                  <button type="button" onClick={() => setMostrarFormCot(false)} className="text-amber-800 font-bold hover:underline">
                    Cerrar
                  </button>
                </div>

                {alertaPrecioMsg && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-card border border-amber-300 text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="font-semibold">{alertaPrecioMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Proveedor (Catálogo)</label>
                    <select
                      required
                      value={provCotId}
                      onChange={(e) => setProvCotId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-input rounded-lg bg-card font-medium"
                    >
                      <option value="">-- Selecciona Proveedor --</option>
                      {todosProveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.tipoProveedor === 'barato' ? '$ Económico' : p.tipoProveedor === 'premium' ? '$$$ Premium' : '$ Estándar'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">Subtotal Moneda</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={subtotalCot}
                        onChange={(e) => setSubtotalCot(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-input rounded-lg font-mono font-bold"
                      />
                      <select
                        value={monedaCot}
                        onChange={(e) => setMonedaCot(e.target.value as 'USD' | 'MXN')}
                        className="px-2 py-1.5 border border-input rounded-lg font-bold bg-card"
                      >
                        <option value="USD">USD</option>
                        <option value="MXN">MXN</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">Lead Time (Días hábiles)</label>
                    <input
                      type="number"
                      min={1}
                      value={leadTimeCot}
                      onChange={(e) => setLeadTimeCot(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border border-input rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground block mb-1">Condiciones de Pago</label>
                    <input
                      type="text"
                      value={condicionesCot}
                      onChange={(e) => setCondicionesCot(e.target.value)}
                      placeholder="Net 30 / Tarjeta de Crédito"
                      className="w-full px-2.5 py-1.5 border border-input rounded-lg bg-card"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1">Notas / Envío a Laredo</label>
                    <input
                      type="text"
                      value={obsCot}
                      onChange={(e) => setObsCot(e.target.value)}
                      placeholder="Stock inmediato FedEx Express"
                      className="w-full px-2.5 py-1.5 border border-input rounded-lg bg-card"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="submit" className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs">
                    Guardar Cotización
                  </button>
                </div>
              </form>
            )}

            {/* MOTOR DE RECOMENDACIÓN INTELIGENTE */}
            {cotizaciones.length > 0 && (
              <SeccionRecomendacionInteligente
                ofertas={cotizaciones.map((c) => ({
                  proveedorId: c.proveedorId,
                  proveedorNombre: c.proveedorNombre,
                  precioTotal: c.total,
                  moneda: c.moneda,
                  leadTimeDias: c.leadTimeDias,
                  condicionesPago: c.condicionesPago,
                  observaciones: c.observaciones,
                  idCotizacion: c.id,
                }))}
                proveedoresCatalogo={todosProveedores}
                evaluacionesHistoricas={evaluaciones}
                comprasHistoricas={todasCompras}
                tipoCambioUsdMxn={tipoCambioUsdMxn}
                confiabilidadPorProveedor={confiabilidadMap}
                onSeleccionarProveedor={async (provId, provNombre, razon) => {
                  const cotMatch = cotizaciones.find((c) => c.proveedorId === provId || c.proveedorNombre.toLowerCase().includes(provNombre.toLowerCase()))
                  if (cotMatch) {
                    await seleccionarGanador(requisicion.id, cotMatch.id, razon)
                  }
                }}
              />
            )}

            {/* TARJETAS DE COTIZACIÓN EN COMPARADOR */}
            {cargandoCot ? (
              <p className="text-xs text-muted-foreground py-4">Cargando cotizaciones...</p>
            ) : errorCot ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-700 space-y-2">
                <p>{errorCot}</p>
                <button
                  type="button"
                  onClick={() => requisicion && cargarCotizaciones(requisicion.id)}
                  className="font-bold underline hover:no-underline"
                >
                  Reintentar
                </button>
              </div>
            ) : rankingCotizaciones.length === 0 ? (
              <ModuleSurface className="border-dashed p-6 text-center text-xs text-muted-foreground shadow-none">
                Aún no hay cotizaciones registradas para esta requisición. Haz clic en <strong>+ Capturar Cotización</strong> para comparar proveedores.
              </ModuleSurface>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rankingCotizaciones.map((cot) => (
                  <div
                    key={cot.id}
                    className={[
                      'p-4 rounded-xl border transition-all space-y-3 relative',
                      cot.ganadora
                        ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20'
                        : cot.esMejorBalance
                        ? 'bg-sky-50/70 border-sky-300'
                        : 'bg-card border-border',
                    ].join(' ')}
                  >
                    {cot.ganadora && (
                      <span className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> GANADOR SELECCIONADO
                      </span>
                    )}

                    <div className="flex flex-wrap items-center gap-1">
                      {cot.esMejorBalance && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1">
                          <Zap className="h-3 w-3" aria-hidden /> #1 Mejor Balance
                        </span>
                      )}
                      {cot.esMejorPrecio && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold font-mono px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" aria-hidden /> Mejor Precio
                        </span>
                      )}
                      {cot.esMasRapido && (
                        <span className="bg-sky-100 text-primary border border-sky-300 text-[10px] font-bold font-mono px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Zap className="h-3 w-3" aria-hidden /> Más Rápido
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{cot.proveedorNombre}</h4>
                        <p className="text-[11px] text-muted-foreground font-mono">Pago: {cot.condicionesPago}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-foreground block font-mono">
                          ${cot.total.toFixed(2)} {cot.moneda}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">{cot.leadTimeDias} días lead time</span>
                      </div>
                    </div>

                    {cot.observaciones && (
                      <p className="text-[11px] text-muted-foreground bg-card p-2 rounded border border-border font-sans leading-snug">
                        {cot.observaciones}
                      </p>
                    )}

                    {!cot.ganadora && (
                      <div className="pt-2 border-t border-border">
                        {cotizacionSeleccionando?.id === cot.id ? (
                          <div className="space-y-2 bg-card p-2.5 rounded-lg border border-amber-300">
                            <label className="text-[11px] font-bold text-amber-900 block">
                              Motivo de elección de este proveedor:
                            </label>
                            <input
                              type="text"
                              value={motivoGanador}
                              onChange={(e) => setMotivoGanador(e.target.value)}
                              placeholder="Ej. Precio 25% menor y entrega en Laredo TX."
                              className="w-full px-2 py-1 text-xs border border-input rounded"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setCotizacionSeleccionando(null)}
                                className="px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:underline"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={procesandoGanador || !motivoGanador.trim()}
                                onClick={handleConfirmarGanador}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded shadow-xs disabled:opacity-50"
                              >
                                Confirmar Ganador
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCotizacionSeleccionando(cot)
                              setMotivoGanador(`Seleccionado por ${cot.esMejorPrecio ? 'mejor precio' : 'lead time más rápido'}.`)
                            }}
                            className="w-full py-1.5 bg-foreground hover:bg-foreground/90 text-background text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Award className="h-3.5 w-3.5 text-amber-400" /> Seleccionar Proveedor Ganador
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GENERADOR DE ORDEN DE COMPRA (OC) */}
          {cotizacionGanadora && (
            <div className="p-4 bg-emerald-900 text-white rounded-xl shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Proveedor Ganador Confirmado: {cotizacionGanadora.proveedorNombre}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Total: <strong>${cotizacionGanadora.total} {cotizacionGanadora.moneda}</strong> · Motivo: {requisicion.motivoSeleccion || 'Mejor oferta'}
                  </p>
                </div>

                {!requisicion.ordenCompraFolio && !ocGeneradaExito && (
                  <button
                    type="button"
                    disabled={generandoOCState}
                    onClick={handleGenerarOCClick}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-foreground text-xs font-black rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {generandoOCState ? 'Generando Orden...' : 'Emitir Orden de Compra (OC)'}
                  </button>
                )}
              </div>

              {(requisicion.ordenCompraFolio || ocGeneradaExito) && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="text-emerald-400 font-mono font-bold">
                      Folio OC: {requisicion.ordenCompraFolio || ocGeneradaExito?.folioOC}
                    </span>
                    <p className="text-[11px] text-emerald-300">
                      La orden fue enviada a la colección de Órdenes y vinculada a esta requisición.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold rounded border border-emerald-500/40">
                    Estatus: COMPRADO / OC EMITIDA
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
