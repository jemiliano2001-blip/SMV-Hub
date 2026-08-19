'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  Search,
  Building2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  Boxes,
  History,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatPrecio } from '@/lib/format'
import { getClienteAuth } from '@/lib/firebase'
import { obtenerTipoCambio, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'
import type {
  ResultadoInvestigacionPrecios,
  MercadoObjetivo,
} from '@/lib/proveedores-investigacion-ia'
import { cruzarConHistoricoLocal } from '@/lib/proveedores-investigacion-ia'
import type { CompraOdooItem, OrdenCompra } from '@/lib/schemas'

interface ModalInvestigacionPreciosProps {
  abierto: boolean
  onClose: () => void
  ordenesHistoricas?: readonly OrdenCompra[]
  itemsOdoo?: readonly CompraOdooItem[]
  usdToMxn?: number
}

const EJEMPLOS_BUSQUEDA = [
  'Endmill 1/2 pulgada 4 filos AlTiN carburo para acero',
  'Placa de aluminio 6061-T6 1/2 pulgada 12x24',
  'Barra redonda Delrin acetal negro 2 pulgadas',
  'Inserto de torneado CNMG 432 para desbaste',
  'Tornillo Allen cabeza cilíndrica 1/4-20 x 1 pulgada inox 316',
]

const ADVERTENCIA_IA =
  'Estimaciones generadas por IA a partir de conocimiento general de mercado. No son cotizaciones reales — verifica precio, SKU y disponibilidad con el proveedor antes de comprar.'

export default function ModalInvestigacionPrecios({
  abierto,
  onClose,
  ordenesHistoricas = [],
  itemsOdoo = [],
  usdToMxn: propUsdToMxn,
}: ModalInvestigacionPreciosProps) {
  const [consulta, setConsulta] = useState('')
  const [mercado, setMercado] = useState<MercadoObjetivo>('ambos')
  const [cantidad, setCantidad] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoInvestigacionPrecios | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [tipoCambioActual, setTipoCambioActual] = useState<number>(
    propUsdToMxn || TIPO_CAMBIO_DEFAULT_USD_MXN
  )

  // Cargar tipo de cambio real desde Firestore al abrir el modal
  useEffect(() => {
    if (!abierto) return
    let activo = true

    async function cargarTC() {
      try {
        const configTC = await obtenerTipoCambio()
        if (activo && configTC.usdToMxn > 0) {
          setTipoCambioActual(configTC.usdToMxn)
        }
      } catch {
        if (activo && propUsdToMxn) {
          setTipoCambioActual(propUsdToMxn)
        }
      }
    }

    void cargarTC()
    return () => {
      activo = false
    }
  }, [abierto, propUsdToMxn])

  const ejecutarInvestigacion = async (termino?: string) => {
    const q = (termino ?? consulta).trim()
    if (!q || q.length < 2) {
      toast.error('Por favor escribe una descripción del insumo o herramienta a investigar.')
      return
    }

    setCargando(true)
    setResultado(null)

    try {
      const auth = getClienteAuth()
      const token = (await auth.currentUser?.getIdToken()) || ''
      const res = await fetch('/api/proveedores/investigar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          consulta: q,
          mercado,
          cantidad: Math.max(1, cantidad),
          tipoCambio: tipoCambioActual,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al ejecutar la investigación con IA')
      }

      // Cruzar con histórico local (seleccionando la compra más reciente)
      const resConHistorico = cruzarConHistoricoLocal(
        data.data as ResultadoInvestigacionPrecios,
        ordenesHistoricas,
        itemsOdoo,
        tipoCambioActual
      )

      setResultado(resConHistorico)
      toast.success('Investigación de mercado completada.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Error: ${msg}`)
    } finally {
      setCargando(false)
    }
  }

  const copiarFichaMarkdown = () => {
    if (!resultado) return

    const lineas = [
      `> **Aviso:** ${ADVERTENCIA_IA}`,
      '',
      `# Estudio de Precios & Proveedores: ${resultado.concepto}`,
      `*Categoría:* ${resultado.categoria} | *Mercado analizado:* ${mercado.toUpperCase()} | *Tipo de cambio:* $${tipoCambioActual.toFixed(2)} MXN/USD`,
      '',
      `## Rango de Mercado`,
      `- **Mínimo:** $${resultado.rangoPreciosUSD.min} USD (~${formatPrecio(resultado.rangoPreciosMXN.min, 'MXN')})`,
      `- **Promedio:** $${resultado.rangoPreciosUSD.promedio} USD (~${formatPrecio(resultado.rangoPreciosMXN.promedio, 'MXN')})`,
      `- **Máximo:** $${resultado.rangoPreciosUSD.max} USD (~${formatPrecio(resultado.rangoPreciosMXN.max, 'MXN')})`,
      '',
      `## Opciones de Proveedores`,
      ...resultado.opciones.map(
        (op) =>
          `- **${op.proveedor}** (${op.mercado}): $${op.precioEstimadoUSD} USD (${formatPrecio(op.precioEstimadoMXN, 'MXN')}) | Entrega: ~${op.tiempoEntregaDias} días | Grado: ${op.calidadGrado}${op.skuReferencia ? ` | SKU: ${op.skuReferencia}` : ''}${op.notas ? ` (${op.notas})` : ''}`
      ),
      '',
      `## Recomendación Estratégica`,
      `- **Mejor Costo:** ${resultado.mejorOpcionCosto}`,
      `- **Mejor Tiempo:** ${resultado.mejorOpcionTiempo}`,
      `- **Notas Técnicas:** ${resultado.recomendacionesTecnicas}`,
      ...(resultado.alternativasMaterial.length > 0
        ? [`- **Alternativas / Sustitutos:** ${resultado.alternativasMaterial.join(', ')}`]
        : []),
      ...(resultado.coincidenciaHistorica?.encontrado
        ? [
            '',
            `## Historial Interno SMV Hub`,
            `- **Última compra registrada:** ${resultado.coincidenciaHistorica.proveedor} a $${resultado.coincidenciaHistorica.precioUltimoUSD} USD el ${resultado.coincidenciaHistorica.fechaUltimaCompra}`,
          ]
        : []),
      '',
      `*Generado con Gemini 3.7 Flash — SMV Hub*`,
    ]

    navigator.clipboard.writeText(lineas.join('\n'))
    setCopiado(true)
    toast.success('Ficha técnica copiada al portapapeles en formato Markdown.')
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-white border border-slate-200 shadow-xl rounded-2xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Asistente de Precios & Proveedores con Gemini 3.7
                  <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200 font-bold">
                    Deep Market Intel
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Consulta precios de referencia, opciones de distribuidores (USA/MX), tiempos de entrega y recomendaciones técnicas para herramientas y materiales.
                </DialogDescription>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-500">TC:</span>
              <span className="text-xs font-mono font-bold text-slate-800">${tipoCambioActual.toFixed(2)} MXN</span>
            </div>
          </div>
        </DialogHeader>

        {/* Formulario de Entrada */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">
              ¿Qué insumo, material o herramienta deseas investigar?
            </label>
            <div className="relative">
              <input
                type="text"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !cargando) ejecutarInvestigacion()
                }}
                placeholder="Ej. Fresa de carburo 1/2 pulgada 4 filos AlTiN para acero 4140..."
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <Button
                type="button"
                onClick={() => ejecutarInvestigacion()}
                disabled={cargando || !consulta.trim()}
                className="absolute right-1.5 top-1.5 h-8 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                {cargando ? 'Buscando...' : 'Investigar'}
              </Button>
            </div>
          </div>

          {/* Filtros de Alcance y Cantidad */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Mercado:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMercado('ambos')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    mercado === 'ambos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Ambos
                </button>
                <button
                  type="button"
                  onClick={() => setMercado('usa')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    mercado === 'usa' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  USA
                </button>
                <button
                  type="button"
                  onClick={() => setMercado('mexico')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    mercado === 'mexico' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  México
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Cantidad:</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
                className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-md font-bold text-slate-800"
              />
            </div>
          </div>

          {/* Sugerencias Rápidas */}
          {!resultado && !cargando && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400">Consultas frecuentes de taller:</span>
              <div className="flex flex-wrap gap-1.5">
                {EJEMPLOS_BUSQUEDA.map((ej, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setConsulta(ej)
                      ejecutarInvestigacion(ej)
                    }}
                    className="text-left text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-primary border border-slate-200 hover:border-sky-200 transition-all font-medium"
                  >
                    {ej}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Estado de Carga */}
          {cargando && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-sky-100 border-t-primary animate-spin" />
                <Sparkles className="w-5 h-5 text-primary absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">Analizando mercado con Gemini 3.7 Flash...</p>
                <p className="text-xs text-slate-500">
                  Consultando distribuidores industriales, calculando rangos y comparando especificaciones.
                </p>
              </div>
            </div>
          )}

          {/* Visualización de Resultados */}
          {resultado && !cargando && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Banner de Aviso de Estimaciones IA */}
              <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong>Aviso importante:</strong> {ADVERTENCIA_IA}
                </p>
              </div>

              {/* Header del Resultado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {resultado.categoria.replace('_', ' ')}
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-200/80 text-slate-700 font-bold">
                      {resultado.opciones.length} opciones
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{resultado.concepto}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={copiarFichaMarkdown}
                    variant="outline"
                    className="h-8 text-xs font-bold gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado ? 'Copiado' : 'Copiar Ficha'}
                  </Button>
                </div>
              </div>

              {/* Cruce con Histórico de SMV Hub */}
              {resultado.coincidenciaHistorica?.encontrado && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950">
                  <History className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-emerald-900">
                      Coincidencia encontrada en compras previas de SMV Hub
                    </div>
                    <p className="text-emerald-800 leading-relaxed">
                      Última compra registrada con <strong>{resultado.coincidenciaHistorica.proveedor}</strong> a{' '}
                      <strong>${resultado.coincidenciaHistorica.precioUltimoUSD} USD</strong> (
                      {formatPrecio(resultado.coincidenciaHistorica.precioUltimoMXN || 0, 'MXN')}) el{' '}
                      {resultado.coincidenciaHistorica.fechaUltimaCompra}.
                    </p>
                    <p className="text-[11px] text-emerald-700 italic">
                      Item: &quot;{resultado.coincidenciaHistorica.descripcionHistorica}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Rango de Mercado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Mínimo de Mercado</span>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    ${resultado.rangoPreciosUSD.min} <span className="text-xs font-semibold">USD</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ~{formatPrecio(resultado.rangoPreciosMXN.min, 'MXN')}
                  </span>
                </div>

                <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 text-center">
                  <span className="text-[11px] font-bold text-sky-800 uppercase">Precio Promedio</span>
                  <div className="text-base font-bold text-primary mt-0.5">
                    ${resultado.rangoPreciosUSD.promedio} <span className="text-xs font-semibold">USD</span>
                  </div>
                  <span className="text-[10px] text-sky-600 font-mono">
                    ~{formatPrecio(resultado.rangoPreciosMXN.promedio, 'MXN')}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Máximo Estimado</span>
                  <div className="text-base font-bold text-amber-700 mt-0.5">
                    ${resultado.rangoPreciosUSD.max} <span className="text-xs font-semibold">USD</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ~{formatPrecio(resultado.rangoPreciosMXN.max, 'MXN')}
                  </span>
                </div>
              </div>

              {/* Comparador de Opciones de Proveedores */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" /> Opciones de Distribuidores
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {resultado.opciones.map((op, idx) => {
                    const esMejorCosto = resultado.mejorOpcionCosto.toLowerCase().includes(op.proveedor.toLowerCase())
                    const esMejorTiempo = resultado.mejorOpcionTiempo.toLowerCase().includes(op.proveedor.toLowerCase())

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          esMejorCosto
                            ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900">{op.proveedor}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-bold ${
                                  op.mercado === 'USA'
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {op.mercado === 'USA' ? 'USA' : 'MX'}
                              </Badge>
                              {esMejorCosto && (
                                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-bold">
                                  Mejor Costo
                                </Badge>
                              )}
                              {esMejorTiempo && (
                                <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0 font-bold">
                                  Entrega Rápida
                                </Badge>
                              )}
                            </div>
                            {op.skuReferencia && (
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                SKU: {op.skuReferencia}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900 font-mono">
                              ${op.precioEstimadoUSD} USD
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ~{formatPrecio(op.precioEstimadoMXN, 'MXN')}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Entrega: <strong>~{op.tiempoEntregaDias} días</strong>
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{op.calidadGrado}</span>
                        </div>

                        {op.notas && (
                          <p className="mt-1.5 text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                            {op.notas}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recomendaciones Técnicas y Alternativas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {resultado.recomendacionesTecnicas && (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-amber-950 space-y-1">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" /> Especificaciones & Recomendación Técnica
                    </span>
                    <p className="text-xs leading-relaxed text-amber-900/90">{resultado.recomendacionesTecnicas}</p>
                  </div>
                )}

                {resultado.alternativasMaterial && resultado.alternativasMaterial.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 space-y-1">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-slate-600" /> Materiales o Grados Sustitutos
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                      {resultado.alternativasMaterial.map((alt, idx) => (
                        <li key={idx}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {resultado.fuentes && resultado.fuentes.length > 0 && (
                <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200/80 text-sky-950 space-y-1.5">
                  <span className="font-bold text-sky-900 text-xs flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-sky-700" /> Fuentes web consultadas
                  </span>
                  <ul className="text-xs space-y-1">
                    {resultado.fuentes.slice(0, 3).map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-800 underline underline-offset-2 break-all hover:text-sky-950"
                        >
                          {url.replace(/^https?:\/\//, '')}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
