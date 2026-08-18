'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  ClipboardPaste,
  Upload,
  Plus,
  Trash2,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Loader2,
  History,
  AlertTriangle,
} from 'lucide-react'
import { parsearTextoExcel } from '@/lib/odoo-cotizador-parser'
import type { PartidaCotizacionOdoo, CotizacionOdooPayload, ExtraccionInvoice } from '@/lib/schemas'
import { getClienteAuth } from '@/lib/firebase'

interface ProveedorSugerido {
  id: number
  name: string
}

export default function CapturaOdooForm({
  onCotizacionCreada,
}: {
  onCotizacionCreada?: () => void
}) {
  // ── Cabecera / Datos Generales ──────────────────────────────────────────────
  const [proveedor, setProveedor] = useState('')
  const [proveedorId, setProveedorId] = useState<number | null>(null)
  const [referenciaProveedor, setReferenciaProveedor] = useState('')
  const [moneda, setMoneda] = useState<'MXN' | 'USD'>('MXN')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [notas] = useState('')

  // ── Valores predeterminados para partidas ──────────────────────────────────
  const [defaultRequisitor, setDefaultRequisitor] = useState('Pablo')
  const [defaultEmpresa, setDefaultEmpresa] = useState('Taller')
  const [defaultUso, setDefaultUso] = useState('General')
  const [defaultUdm, setDefaultUdm] = useState('Pieza')
  const [defaultImpuesto, setDefaultImpuesto] = useState('IVA 16%')
  const [defaultTasaIva, setDefaultTasaIva] = useState(0.16)

  // ── Estado de Partidas ─────────────────────────────────────────────────────
  const [partidas, setPartidas] = useState<PartidaCotizacionOdoo[]>([])
  const [textoPegado, setTextoPegado] = useState('')
  const [advertenciasParser, setAdvertenciasParser] = useState<string[]>([])

  // ── Extracción con IA Gemini ───────────────────────────────────────────────
  const [extrayendoIa, setExtrayendoIa] = useState(false)
  const [mensajeIa, setMensajeIa] = useState<string | null>(null)

  // ── Autocomplete Proveedores Odoo ──────────────────────────────────────────
  const [sugerenciasProveedores, setSugerenciasProveedores] = useState<ProveedorSugerido[]>([])
  const [cargandoProveedores, setCargandoProveedores] = useState(false)

  // ── Envío / Estado Odoo ────────────────────────────────────────────────────
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [resultadoExitoso, setResultadoExitoso] = useState<{
    odooId: number
    odooName: string
    proveedor: string
    total: number
    moneda: string
    itemsCount: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputIaRef = useRef<HTMLInputElement>(null)

  // Buscar proveedores en Odoo al escribir (debounced)
  useEffect(() => {
    let cancelado = false

    if (!proveedor || proveedor.trim().length < 2) {
      const id = setTimeout(() => {
        if (!cancelado) setSugerenciasProveedores([])
      }, 0)
      return () => {
        cancelado = true
        clearTimeout(id)
      }
    }

    const timer = setTimeout(async () => {
      try {
        if (!cancelado) setCargandoProveedores(true)
        const token = await getClienteAuth().currentUser?.getIdToken()
        if (!token) return

        const res = await fetch(`/api/odoo/proveedores?q=${encodeURIComponent(proveedor.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelado) {
          const data = await res.json()
          if (data.proveedores) {
            setSugerenciasProveedores(data.proveedores)
          }
        }
      } catch {
        // Silencioso
      } finally {
        if (!cancelado) setCargandoProveedores(false)
      }
    }, 280)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [proveedor])

  // ── Procesar texto pegado desde Excel / Sheets ─────────────────────────────
  const procesarTextoPegado = useCallback(
    (raw: string) => {
      if (!raw || !raw.trim()) return

      const res = parsearTextoExcel(raw, {
        requisitor: defaultRequisitor,
        empresa: defaultEmpresa,
        uso: defaultUso,
        udm: defaultUdm,
        impuesto: defaultImpuesto,
        tasaIva: defaultTasaIva,
      })

      if (res.advertencias && res.advertencias.length > 0) {
        setAdvertenciasParser(res.advertencias)
      } else {
        setAdvertenciasParser([])
      }

      if (res.partidas.length > 0) {
        setPartidas((prev) => [...prev, ...res.partidas])
        setTextoPegado('')
      }
    },
    [defaultRequisitor, defaultEmpresa, defaultUso, defaultUdm, defaultImpuesto, defaultTasaIva]
  )

  // ── Extracción con IA Gemini (PDF / Imagen / Screenshot) ───────────────────
  const procesarArchivoConIA = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setErrorEnvio('El archivo debe ser una imagen (PNG, JPG, WebP) o un archivo PDF.')
        return
      }

      setExtrayendoIa(true)
      setErrorEnvio(null)
      setMensajeIa(null)
      setAdvertenciasParser([])

      try {
        const token = await getClienteAuth().currentUser?.getIdToken()
        if (!token) throw new Error('Inicia sesión para usar la extracción con IA.')

        const fd = new FormData()
        fd.append('imagen', file)

        const res = await fetch('/api/extraer', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })

        let data: { error?: string }
        try {
          data = (await res.json()) as { error?: string }
        } catch {
          throw new Error(
            res.ok
              ? 'El servidor respondió con un formato inválido. Intenta de nuevo.'
              : `Error del servidor (${res.status}). Si subiste un PDF grande, prueba con una imagen o pega la tabla desde Excel.`
          )
        }
        if (!res.ok) {
          throw new Error(data.error || 'Error al procesar el archivo con IA.')
        }

        const ext = data as ExtraccionInvoice

        // Autollenar cabecera con lo que detecte la IA
        if (ext.proveedor && !proveedor) {
          setProveedor(ext.proveedor)
        }
        if (ext.numeroFactura && !referenciaProveedor) {
          setReferenciaProveedor(ext.numeroFactura)
        }
        if (ext.moneda === 'USD' || ext.moneda === 'MXN') {
          setMoneda(ext.moneda)
          if (ext.moneda === 'USD') {
            setDefaultTasaIva(0)
            setDefaultImpuesto('Tasa 0% / Importación')
          }
        }
        if (ext.fechaFactura) {
          setFecha(ext.fechaFactura)
        }

        // Convertir partidas extraídas
        if (ext.items && ext.items.length > 0) {
          const nuevasPartidas: PartidaCotizacionOdoo[] = ext.items.map((item, idx) => {
            const cant =
              typeof item.cantidad === 'number' && item.cantidad > 0 ? item.cantidad : 1
            const precio =
              typeof item.precioUnitario === 'number' && item.precioUnitario >= 0
                ? item.precioUnitario
                : 0
            const subtotal = Math.round(cant * precio * 100) / 100

            return {
              id: `ia_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              partida: partidas.length + idx + 1,
              clave: '',
              descripcion: item.descripcion || 'Sin descripción',
              cantidad: cant,
              udm: defaultUdm,
              precioUnitario: precio,
              subtotal,
              impuesto: defaultImpuesto,
              tasaIva: defaultTasaIva,
              requisitor: item.requisitor || defaultRequisitor,
              empresa: item.empresa || defaultEmpresa,
              uso: item.cuentaCargo || defaultUso,
            }
          })

          setPartidas((prev) => [...prev, ...nuevasPartidas])
          setMensajeIa(
            `✨ IA Gemini extrajo ${nuevasPartidas.length} partidas desde "${file.name}". Revisa los montos y completa los datos necesarios en la tabla.`
          )
        } else {
          setMensajeIa(
            `✨ IA Gemini leyó el documento pero no identificó partidas desglosadas. Puedes capturarlas en la tabla o pegar de Excel.`
          )
        }
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err)
        if (mensaje === 'Failed to fetch') {
          setErrorEnvio(
            'La conexión con el servidor se cerró antes de terminar. Suele pasar con PDFs grandes o cuando la IA tarda demasiado. Intenta de nuevo con una imagen más liviana, o pega la tabla desde Excel.'
          )
        } else {
          setErrorEnvio(mensaje)
        }
      } finally {
        setExtrayendoIa(false)
      }
    },
    [
      proveedor,
      referenciaProveedor,
      partidas.length,
      defaultUdm,
      defaultImpuesto,
      defaultTasaIva,
      defaultRequisitor,
      defaultEmpresa,
      defaultUso,
    ]
  )

  // ── Manejo de evento Paste unificado (Texto Excel O Imagen de Screenshot) ──
  const handlePasteEvent = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 1. Checar si se pegó una imagen desde el portapapeles (screenshot)
    const items = Array.from(e.clipboardData.items)
    const itemImagen = items.find((it) => it.type.startsWith('image/'))
    if (itemImagen) {
      const file = itemImagen.getAsFile()
      if (file) {
        e.preventDefault()
        await procesarArchivoConIA(file)
        return
      }
    }

    // 2. Si es texto, procesar tabla de Excel / TSV
    const pasteData = e.clipboardData.getData('text')
    if (pasteData && (pasteData.includes('\t') || pasteData.includes('\n'))) {
      e.preventDefault()
      procesarTextoPegado(pasteData)
    }
  }

  // ── Subida de Archivo CSV / TSV ────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        procesarTextoPegado(content)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Subida de PDF / Imagen para IA ─────────────────────────────────────────
  const handleFileIaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await procesarArchivoConIA(file)
    e.target.value = ''
  }

  // ── Manejo de Partidas en Tabla ────────────────────────────────────────────
  const agregarFilaVacia = () => {
    const nueva: PartidaCotizacionOdoo = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      partida: partidas.length + 1,
      clave: '',
      descripcion: '',
      cantidad: 1,
      udm: defaultUdm,
      precioUnitario: 0,
      subtotal: 0,
      impuesto: defaultImpuesto,
      tasaIva: defaultTasaIva,
      requisitor: defaultRequisitor,
      empresa: defaultEmpresa,
      uso: defaultUso,
    }
    setPartidas((prev) => [...prev, nueva])
  }

  const actualizarPartida = (id: string, campo: keyof PartidaCotizacionOdoo, valor: unknown) => {
    setPartidas((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        const updated = { ...p, [campo]: valor }

        if (campo === 'cantidad' || campo === 'precioUnitario') {
          const cant =
            typeof updated.cantidad === 'number' ? updated.cantidad : Number(updated.cantidad) || 0
          const precio =
            typeof updated.precioUnitario === 'number'
              ? updated.precioUnitario
              : Number(updated.precioUnitario) || 0
          updated.subtotal = Math.round(cant * precio * 100) / 100
        }
        return updated
      })
    )
  }

  const eliminarPartida = (id: string) => {
    setPartidas((prev) => prev.filter((p) => p.id !== id))
  }

  const limpiarTodo = () => {
    if (partidas.length === 0 || window.confirm('¿Deseas limpiar todas las partidas capturadas?')) {
      setPartidas([])
      setResultadoExitoso(null)
      setErrorEnvio(null)
      setMensajeIa(null)
      setAdvertenciasParser([])
    }
  }

  // ── Totales Calculados ─────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const subtotal = partidas.reduce((acc, p) => acc + (p.subtotal || 0), 0)
    const iva = partidas.reduce((acc, p) => acc + (p.subtotal || 0) * (p.tasaIva ?? 0.16), 0)
    const total = subtotal + iva
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(total * 100) / 100,
    }
  }, [partidas])

  // ── Enviar a Odoo ──────────────────────────────────────────────────────────
  const enviarAOdoo = async () => {
    if (!proveedor.trim()) {
      setErrorEnvio('Por favor especifica el Proveedor.')
      return
    }
    if (partidas.length === 0) {
      setErrorEnvio('Debes agregar al menos 1 partida para cotizar.')
      return
    }

    const partidasInvalidas = partidas.filter((p) => !p.descripcion.trim() || p.cantidad <= 0)
    if (partidasInvalidas.length > 0) {
      setErrorEnvio('Hay partidas con descripción vacía o cantidad menor o igual a 0. Revisa la tabla.')
      return
    }

    setErrorEnvio(null)
    setEnviando(true)

    try {
      const token = await getClienteAuth().currentUser?.getIdToken()
      if (!token) throw new Error('No se pudo obtener la sesión actual. Recarga la página.')

      const payload: CotizacionOdooPayload = {
        proveedor: proveedor.trim(),
        proveedorId,
        referenciaProveedor: referenciaProveedor.trim(),
        moneda,
        fecha,
        requisitorGeneral: defaultRequisitor,
        empresaGeneral: defaultEmpresa,
        usoGeneral: defaultUso,
        notas,
        partidas,
      }

      const res = await fetch('/api/odoo/crear-cotizacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.detalles || data.error || 'Ocurrió un error al crear en Odoo.')
      }

      setResultadoExitoso({
        odooId: data.data.odooId,
        odooName: data.data.odooName,
        proveedor: data.data.proveedorNombre || proveedor,
        total: data.data.total,
        moneda: data.data.moneda,
        itemsCount: data.data.itemsCount,
      })
    } catch (err) {
      setErrorEnvio(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Modal de Éxito al Crear en Odoo ───────────────────────────────── */}
      {resultadoExitoso && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/95 p-4 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950">
                  Solicitud de Cotización Creada Exitosamente en Odoo
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Folio asignado por Odoo:{' '}
                  <span className="font-mono font-bold text-emerald-950 bg-emerald-200/80 px-2 py-0.5 rounded border border-emerald-300">
                    {resultadoExitoso.odooName}
                  </span>{' '}
                  para <span className="font-semibold">{resultadoExitoso.proveedor}</span> ({resultadoExitoso.itemsCount} partidas).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://system.maquinadosvazquez.com/web#id=${resultadoExitoso.odooId}&model=purchase.order&view_type=form`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:outline-none transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver en Odoo ERP
              </a>
              {onCotizacionCreada && (
                <button
                  type="button"
                  onClick={onCotizacionCreada}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
                >
                  <History className="h-3.5 w-3.5" />
                  Ver Historial
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setResultadoExitoso(null)
                  setPartidas([])
                  setReferenciaProveedor('')
                  setMensajeIa(null)
                  setAdvertenciasParser([])
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Nueva Captura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mensaje / Banner de Éxito de Extracción con IA ────────────────── */}
      {mensajeIa && (
        <div className="rounded-xl border border-sky-300 bg-sky-50/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-950">
              <Sparkles className="h-4 w-4 shrink-0 text-sky-600" />
              <span className="text-xs font-semibold">{mensajeIa}</span>
            </div>
            <button
              type="button"
              onClick={() => setMensajeIa(null)}
              className="text-xs text-sky-600 hover:text-sky-900 font-bold ml-2 p-1"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Banner de Advertencias del Parser ──────────────────────────────── */}
      {advertenciasParser.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              Avisos del análisis de la tabla pegada ({advertenciasParser.length}):
            </div>
            <button
              type="button"
              onClick={() => setAdvertenciasParser([])}
              className="text-xs text-amber-700 hover:text-amber-950 font-bold px-1"
              aria-label="Cerrar avisos del parser"
            >
              ✕
            </button>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-900/90 space-y-0.5 pl-1">
            {advertenciasParser.map((adv, idx) => (
              <li key={idx}>{adv}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {errorEnvio && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="text-xs font-semibold">{errorEnvio}</span>
          </div>
        </div>
      )}

      {/* ── Grid Cabecera: Datos Generales + Valores por Defecto ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Card 1: Datos de la Cotización */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Datos de la Cotización
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Proveedor *
              </label>
              <input
                type="text"
                placeholder="ej. PROTOSA, HIGOH..."
                value={proveedor}
                onChange={(e) => {
                  setProveedor(e.target.value)
                  setProveedorId(null)
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
              />
              {cargandoProveedores && (
                <span className="absolute right-2 top-7 text-[10px] text-slate-400 font-mono">Buscando...</span>
              )}
              {sugerenciasProveedores.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  {sugerenciasProveedores.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setProveedor(s.name)
                        setProveedorId(s.id)
                        setSugerenciasProveedores([])
                      }}
                      className="w-full text-left rounded px-2 py-1 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Ref. Proveedor / Cotización
              </label>
              <input
                type="text"
                placeholder="ej. 251165"
                value={referenciaProveedor}
                onChange={(e) => setReferenciaProveedor(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Moneda
              </label>
              <select
                value={moneda}
                onChange={(e) => {
                  const nuevaMoneda = e.target.value as 'MXN' | 'USD'
                  setMoneda(nuevaMoneda)
                  if (nuevaMoneda === 'USD' && defaultTasaIva === 0.16) {
                    setDefaultTasaIva(0)
                    setDefaultImpuesto('Tasa 0% / Importación')
                  } else if (nuevaMoneda === 'MXN' && defaultTasaIva === 0) {
                    setDefaultTasaIva(0.16)
                    setDefaultImpuesto('IVA 16%')
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none bg-white transition-all font-medium"
              >
                <option value="MXN">MXN (Pesos Mexicanos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Valores por Defecto para Partidas */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Autollenado de Partidas
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Asignado por defecto</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Requisitor
              </label>
              <input
                type="text"
                value={defaultRequisitor}
                onChange={(e) => setDefaultRequisitor(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Empresa
              </label>
              <input
                type="text"
                value={defaultEmpresa}
                onChange={(e) => setDefaultEmpresa(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Uso
              </label>
              <input
                type="text"
                value={defaultUso}
                onChange={(e) => setDefaultUso(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                UdM
              </label>
              <input
                type="text"
                value={defaultUdm}
                onChange={(e) => setDefaultUdm(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                Impuesto
              </label>
              <select
                value={defaultTasaIva}
                onChange={(e) => {
                  const tasa = parseFloat(e.target.value) || 0
                  setDefaultTasaIva(tasa)
                  setDefaultImpuesto(
                    tasa === 0.16 ? 'IVA 16%' : tasa === 0.08 ? 'IVA 8%' : 'Tasa 0% / Exento'
                  )
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
              >
                <option value={0.16}>IVA 16%</option>
                <option value={0.08}>IVA 8% (Frontera)</option>
                <option value={0}>Tasa 0% (Importación)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zona de Captura Dual: Pegar de Excel O Escanear PDF/Imagen con IA ─ */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Entrada Rápida de Partidas (Excel, Sheets o IA Gemini)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Input oculto para CSV/TSV */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            {/* Input oculto para PDF / Imagen (IA) */}
            <input
              type="file"
              ref={fileInputIaRef}
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileIaUpload}
              className="hidden"
            />

            <button
              type="button"
              disabled={extrayendoIa}
              onClick={() => fileInputIaRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/80 px-2.5 py-1 text-xs font-bold text-purple-900 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 transition-colors shadow-2xs"
            >
              {extrayendoIa ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              )}
              {extrayendoIa ? 'Extrayendo con IA...' : 'Escanear PDF / Imagen (IA)'}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              Subir CSV/TSV
            </button>

            <button
              type="button"
              onClick={agregarFilaVacia}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              + Agregar Fila
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            placeholder="Pega aquí (Ctrl + V) la tabla copiada de Excel / Google Sheets, o pega una captura de pantalla (screenshot) de la cotización para que la IA la procese automáticamente..."
            value={textoPegado}
            onChange={(e) => setTextoPegado(e.target.value)}
            onPaste={handlePasteEvent}
            disabled={extrayendoIa}
            className={`w-full rounded-lg border border-dashed p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:outline-none transition-all font-mono ${
              extrayendoIa
                ? 'border-purple-300 bg-purple-50/40 opacity-75'
                : 'border-blue-300 bg-blue-50/30 focus:border-blue-500 focus:ring-blue-500/20'
            }`}
          />

          {extrayendoIa && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-2xs rounded-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                La IA Gemini está leyendo las partidas de la cotización...
              </div>
            </div>
          )}

          {textoPegado.trim().length > 0 && !extrayendoIa && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => procesarTextoPegado(textoPegado)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Procesar Tabla Pegada
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabla de Partidas Interactiva ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-900">
              Partidas a Cotizar ({partidas.length})
            </h3>
          </div>

          {partidas.length > 0 && (
            <button
              type="button"
              onClick={limpiarTodo}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpiar Partidas
            </button>
          )}
        </div>

        {partidas.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="flex justify-center gap-2 text-slate-300">
              <FileSpreadsheet className="h-8 w-8" />
              <FileText className="h-8 w-8" />
              <ImageIcon className="h-8 w-8" />
            </div>
            <p className="text-xs font-semibold text-slate-700 max-w-md mx-auto">
              Aún no has agregado partidas.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1">
              <p>• Copiar celdas de Excel / Google Sheets y presionar <strong className="font-mono text-slate-700 font-bold">Ctrl + V</strong></p>
              <p>• Pegar captura o subir <strong className="text-purple-800 font-bold">PDF o imagen</strong> con IA Gemini</p>
              <p>• Hacer clic en <strong className="text-blue-800 font-bold">+ Agregar Fila</strong> para captura manual</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-28">Clave</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Descripción *</th>
                  <th className="py-2.5 px-3 w-24">Requisitor</th>
                  <th className="py-2.5 px-3 w-20">Empresa</th>
                  <th className="py-2.5 px-3 w-20">Uso</th>
                  <th className="py-2.5 px-3 w-20 text-right">Cant.</th>
                  <th className="py-2.5 px-3 w-16">UdM</th>
                  <th className="py-2.5 px-3 w-24 text-right">P. Unitario</th>
                  <th className="py-2.5 px-2 w-20 text-center">IVA</th>
                  <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partidas.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {item.partida || idx + 1}
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.clave || ''}
                        onChange={(e) => actualizarPartida(item.id, 'clave', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 bg-transparent px-1.5 py-0.5 text-xs text-slate-900 font-mono"
                        placeholder="Clave"
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => actualizarPartida(item.id, 'descripcion', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 bg-transparent px-1.5 py-0.5 text-xs text-slate-900 font-medium"
                        placeholder="Descripción de la pieza *"
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.requisitor || ''}
                        onChange={(e) => actualizarPartida(item.id, 'requisitor', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 bg-transparent px-1.5 py-0.5 text-xs text-slate-700"
                        placeholder="Pablo..."
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.empresa || ''}
                        onChange={(e) => actualizarPartida(item.id, 'empresa', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 bg-transparent px-1.5 py-0.5 text-xs text-slate-700"
                        placeholder="Taller"
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.uso || ''}
                        onChange={(e) => actualizarPartida(item.id, 'uso', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500/20 bg-transparent px-1.5 py-0.5 text-xs text-slate-700"
                        placeholder="General"
                      />
                    </td>

                    <td className="py-1.5 px-3 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarPartida(item.id, 'cantidad', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white bg-transparent px-1.5 py-0.5 text-xs text-slate-900 font-mono text-right font-semibold tabular-nums"
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.udm || 'Pieza'}
                        onChange={(e) => actualizarPartida(item.id, 'udm', e.target.value)}
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white bg-transparent px-1.5 py-0.5 text-xs text-slate-700"
                      />
                    </td>

                    <td className="py-1.5 px-3 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.precioUnitario}
                        onChange={(e) =>
                          actualizarPartida(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white bg-transparent px-1.5 py-0.5 text-xs text-slate-900 font-mono text-right font-semibold tabular-nums"
                      />
                    </td>

                    <td className="py-1.5 px-2 text-center">
                      <select
                        value={item.tasaIva !== undefined ? item.tasaIva : 0.16}
                        onChange={(e) => {
                          const tasa = parseFloat(e.target.value) || 0
                          actualizarPartida(item.id, 'tasaIva', tasa)
                          actualizarPartida(
                            item.id,
                            'impuesto',
                            tasa === 0.16 ? 'IVA 16%' : tasa === 0.08 ? 'IVA 8%' : 'Tasa 0% / Exento'
                          )
                        }}
                        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 font-mono font-medium focus:border-blue-500 focus:outline-none"
                      >
                        <option value={0.16}>16%</option>
                        <option value={0.08}>8%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>

                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      $
                      {item.subtotal.toLocaleString('es-MX', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => eliminarPartida(item.id)}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                        title="Eliminar partida"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Barra de Totales y Botón de Creación ─────────────────────────── */}
        <div className="border-t border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Subtotal</span>
              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                ${totales.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {moneda}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">IVA Estimado</span>
              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                ${totales.iva.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {moneda}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">Total Cotización</span>
              <span className="text-base font-extrabold text-blue-900 font-mono tabular-nums">
                ${totales.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {moneda}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={enviando || partidas.length === 0 || !proveedor.trim()}
            onClick={enviarAOdoo}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              enviando || partidas.length === 0 || !proveedor.trim()
                ? 'bg-slate-400 cursor-not-allowed opacity-75'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
            }`}
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {enviando ? 'Enviando a Odoo ERP...' : 'Crear Cotización en Odoo ERP'}
          </button>
        </div>
      </div>
    </div>
  )
}
