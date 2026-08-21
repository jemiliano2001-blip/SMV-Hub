'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  History,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { parsearTextoExcel } from '@/lib/odoo-cotizador-parser'
import { fechaHoyLocal } from '@/lib/format'
import type { PartidaCotizacionOdoo, CotizacionOdooPayload, ExtraccionInvoice } from '@/lib/schemas'
import { getClienteAuth } from '@/lib/firebase'

import DialogoConfirmarCotizacion from './components/DialogoConfirmarCotizacion'
import SeccionAutollenado from './components/SeccionAutollenado'
import SeccionDatosCotizacion from './components/SeccionDatosCotizacion'
import SeccionEntradaRapida from './components/SeccionEntradaRapida'
import TablaPartidasCotizacion from './components/TablaPartidasCotizacion'
import type { OrdenTrabajoSugerida, ProveedorSugerido } from './components/tipos-captura'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

export default function CapturaOdooForm({
  onCotizacionCreada,
}: {
  onCotizacionCreada?: () => void
}) {
  const confirmar = useConfirmDialog()
  const [proveedor, setProveedor] = useState('')
  const [proveedorId, setProveedorId] = useState<number | null>(null)
  const [referenciaProveedor, setReferenciaProveedor] = useState('')
  const [moneda, setMoneda] = useState<'MXN' | 'USD'>('MXN')
  const [fecha, setFecha] = useState(() => fechaHoyLocal())
  const [fechaRecepcion, setFechaRecepcion] = useState(() => fechaHoyLocal())
  const [notas, setNotas] = useState('')
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [intentoCrearSinProveedor, setIntentoCrearSinProveedor] = useState(false)

  const [defaultRequisitor, setDefaultRequisitor] = useState('Pablo')
  const [defaultEmpresa, setDefaultEmpresa] = useState('Taller')
  const [defaultUso, setDefaultUso] = useState('General')
  const [defaultOrdenTrabajo, setDefaultOrdenTrabajo] = useState('')
  const [defaultOrdenTrabajoId, setDefaultOrdenTrabajoId] = useState<number | null>(null)
  const [defaultUdm, setDefaultUdm] = useState('Pieza')
  const [defaultImpuesto, setDefaultImpuesto] = useState('IVA 16%')
  const [defaultTasaIva, setDefaultTasaIva] = useState(0.16)

  const [ordenesTrabajo, setOrdenesTrabajo] = useState<OrdenTrabajoSugerida[]>([])
  const [cargandoOTs, setCargandoOTs] = useState(false)
  const [busquedaOtCabecera, setBusquedaOtCabecera] = useState('')
  const [mostrarDropdownOt, setMostrarDropdownOt] = useState(false)

  const [partidas, setPartidas] = useState<PartidaCotizacionOdoo[]>([])
  const [textoPegado, setTextoPegado] = useState('')
  const [advertenciasParser, setAdvertenciasParser] = useState<string[]>([])

  const [extrayendoIa, setExtrayendoIa] = useState(false)
  const [mensajeIa, setMensajeIa] = useState<string | null>(null)

  const [sugerenciasProveedores, setSugerenciasProveedores] = useState<ProveedorSugerido[]>([])
  const [cargandoProveedores, setCargandoProveedores] = useState(false)

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

  const proveedorInvalido =
    intentoCrearSinProveedor || (proveedor.trim().length > 0 && proveedorId == null)

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

  useEffect(() => {
    let cancelado = false
    const timer = setTimeout(async () => {
      try {
        if (!cancelado) setCargandoOTs(true)
        const token = await getClienteAuth().currentUser?.getIdToken()
        if (!token) return

        const q = busquedaOtCabecera.trim()
        const url =
          q.length >= 1
            ? `/api/odoo/ordenes-trabajo?q=${encodeURIComponent(q)}&limit=50`
            : `/api/odoo/ordenes-trabajo?limit=50`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelado) {
          const data = await res.json()
          if (data.ordenes) {
            setOrdenesTrabajo(data.ordenes)
          }
        }
      } catch {
        // Silencioso
      } finally {
        if (!cancelado) setCargandoOTs(false)
      }
    }, busquedaOtCabecera.trim() ? 260 : 0)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [busquedaOtCabecera])

  const seleccionarOtCabecera = (ot: OrdenTrabajoSugerida) => {
    setDefaultOrdenTrabajo(ot.name)
    setDefaultOrdenTrabajoId(ot.id)
    setDefaultUso(ot.name)
    setBusquedaOtCabecera(ot.name)
    if (ot.partnerName) {
      const cliente = ot.partnerName.replace(/\*$/, '').trim()
      setDefaultEmpresa(cliente)
    }
    setMostrarDropdownOt(false)
  }

  const seleccionarOtFila = (partidaId: string, valor: string) => {
    const valorTrim = valor.trim()
    const otEncontrada = ordenesTrabajo.find(
      (ot) =>
        ot.name.toLowerCase() === valorTrim.toLowerCase() ||
        ot.name.endsWith(`/${valorTrim}`) ||
        (ot.clientOrderRef && ot.clientOrderRef.toLowerCase() === valorTrim.toLowerCase())
    )

    if (otEncontrada) {
      actualizarPartida(partidaId, 'ordenTrabajo', otEncontrada.name)
      actualizarPartida(partidaId, 'ordenTrabajoId', otEncontrada.id)
      actualizarPartida(partidaId, 'uso', otEncontrada.name)
      const p = partidas.find((it) => it.id === partidaId)
      if (p && (!p.empresa || p.empresa === 'Taller')) {
        actualizarPartida(
          partidaId,
          'empresa',
          otEncontrada.partnerName.replace(/\*$/, '').trim()
        )
      }
    } else {
      actualizarPartida(partidaId, 'ordenTrabajo', valor)
      actualizarPartida(partidaId, 'uso', valor)
      actualizarPartida(partidaId, 'ordenTrabajoId', null)
    }
  }

  const procesarTextoPegado = useCallback(
    (raw: string) => {
      if (!raw || !raw.trim()) return

      const res = parsearTextoExcel(raw, {
        requisitor: defaultRequisitor,
        empresa: defaultEmpresa,
        uso: defaultUso,
        ordenTrabajo: defaultOrdenTrabajo || defaultUso,
        ordenTrabajoId: defaultOrdenTrabajoId,
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
    [
      defaultRequisitor,
      defaultEmpresa,
      defaultUso,
      defaultOrdenTrabajo,
      defaultOrdenTrabajoId,
      defaultUdm,
      defaultImpuesto,
      defaultTasaIva,
    ]
  )

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
              ordenTrabajo:
                item.ordenTrabajo ||
                defaultOrdenTrabajo ||
                item.cuentaCargo ||
                defaultUso,
              ordenTrabajoId: defaultOrdenTrabajoId,
            }
          })

          setPartidas((prev) => [...prev, ...nuevasPartidas])
          setMensajeIa(
            `IA extrajo ${nuevasPartidas.length} partidas desde "${file.name}". Revisa los montos y completa los datos en la tabla.`
          )
        } else {
          setMensajeIa(
            `IA leyó el documento pero no identificó partidas desglosadas. Puedes capturarlas en la tabla o pegar de Excel.`
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
      defaultOrdenTrabajo,
      defaultOrdenTrabajoId,
    ]
  )

  const handlePasteEvent = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

    const pasteData = e.clipboardData.getData('text')
    if (pasteData && (pasteData.includes('\t') || pasteData.includes('\n'))) {
      e.preventDefault()
      procesarTextoPegado(pasteData)
    }
  }

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

  const handleFileIaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await procesarArchivoConIA(file)
    e.target.value = ''
  }

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
      ordenTrabajo: defaultOrdenTrabajo || defaultUso,
      ordenTrabajoId: defaultOrdenTrabajoId,
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

  const limpiarTodo = async () => {
    if (partidas.length > 0) {
      const aceptado = await confirmar({
        title: 'Limpiar la captura',
        description: `Se descartarán las ${partidas.length} partidas capturadas. No se puede deshacer.`,
        confirmLabel: 'Limpiar todo',
        variant: 'destructive',
      })
      if (!aceptado) return
    }
    setPartidas([])
    setResultadoExitoso(null)
    setErrorEnvio(null)
    setMensajeIa(null)
    setAdvertenciasParser([])
  }

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

  const puedeIntentarCrear = partidas.length > 0 && proveedor.trim().length > 0

  const solicitarCrear = () => {
    setErrorEnvio(null)

    if (!proveedor.trim()) {
      setErrorEnvio('Por favor especifica el Proveedor.')
      setIntentoCrearSinProveedor(true)
      return
    }
    if (proveedorId == null) {
      setIntentoCrearSinProveedor(true)
      setErrorEnvio('Selecciona un proveedor de la lista de Odoo antes de crear la cotización.')
      return
    }
    if (partidas.length === 0) {
      setErrorEnvio('Debes agregar al menos 1 partida para cotizar.')
      return
    }

    const partidasInvalidas = partidas.filter((p) => !p.descripcion.trim() || p.cantidad <= 0)
    if (partidasInvalidas.length > 0) {
      setErrorEnvio(
        'Hay partidas con descripción vacía o cantidad menor o igual a 0. Revisa la tabla.'
      )
      return
    }

    setIntentoCrearSinProveedor(false)
    setMostrarConfirmacion(true)
  }

  const enviarAOdoo = async () => {
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
        fechaRecepcion,
        requisitorGeneral: defaultRequisitor,
        empresaGeneral: defaultEmpresa,
        usoGeneral: defaultUso,
        ordenTrabajoGeneral: defaultOrdenTrabajo || defaultUso,
        ordenTrabajoGeneralId: defaultOrdenTrabajoId,
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

      setMostrarConfirmacion(false)
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
      setMostrarConfirmacion(false)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {resultadoExitoso && (
        <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950">
          <CheckCircle2 className="text-emerald-700" />
          <AlertTitle>Solicitud de cotización creada en Odoo</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Folio{' '}
              <span className="rounded border border-emerald-300 bg-emerald-200/80 px-2 py-0.5 font-mono font-bold">
                {resultadoExitoso.odooName}
              </span>{' '}
              para <span className="font-semibold">{resultadoExitoso.proveedor}</span> (
              {resultadoExitoso.itemsCount} partidas).
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-800">
                <a
                  href={`https://system.maquinadosvazquez.com/web#id=${resultadoExitoso.odooId}&model=purchase.order&view_type=form`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink data-icon="inline-start" />
                  Ver en Odoo ERP
                </a>
              </Button>
              {onCotizacionCreada && (
                <Button type="button" variant="outline" size="sm" onClick={onCotizacionCreada}>
                  <History data-icon="inline-start" />
                  Ver Historial
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResultadoExitoso(null)
                  setPartidas([])
                  setReferenciaProveedor('')
                  setNotas('')
                  setMensajeIa(null)
                  setAdvertenciasParser([])
                }}
              >
                <RotateCcw data-icon="inline-start" />
                Nueva Captura
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {mensajeIa && (
        <Alert className="border-sky-300 bg-sky-50 text-sky-950">
          <Sparkles className="text-sky-600" />
          <AlertTitle>Extracción IA</AlertTitle>
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{mensajeIa}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMensajeIa(null)}
              aria-label="Cerrar aviso"
            >
              ✕
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {advertenciasParser.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="text-amber-600" />
          <AlertTitle>Avisos del análisis ({advertenciasParser.length})</AlertTitle>
          <AlertDescription>
            <div className="flex items-start justify-between gap-2">
              <ul className="list-inside list-disc">
                {advertenciasParser.map((adv, idx) => (
                  <li key={idx}>{adv}</li>
                ))}
              </ul>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdvertenciasParser([])}
                aria-label="Cerrar avisos del parser"
              >
                ✕
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {errorEnvio && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorEnvio}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SeccionDatosCotizacion
          proveedor={proveedor}
          proveedorId={proveedorId}
          referenciaProveedor={referenciaProveedor}
          moneda={moneda}
          fecha={fecha}
          fechaRecepcion={fechaRecepcion}
          notas={notas}
          sugerenciasProveedores={sugerenciasProveedores}
          cargandoProveedores={cargandoProveedores}
          proveedorInvalido={proveedorInvalido}
          onProveedorChange={(v) => {
            setProveedor(v)
            setProveedorId(null)
            setIntentoCrearSinProveedor(false)
          }}
          onSeleccionarProveedor={(p) => {
            setProveedor(p.name)
            setProveedorId(p.id)
            setSugerenciasProveedores([])
            setIntentoCrearSinProveedor(false)
          }}
          onReferenciaChange={setReferenciaProveedor}
          onMonedaChange={(nuevaMoneda) => {
            setMoneda(nuevaMoneda)
            if (nuevaMoneda === 'USD' && defaultTasaIva === 0.16) {
              setDefaultTasaIva(0)
              setDefaultImpuesto('Tasa 0% / Importación')
            } else if (nuevaMoneda === 'MXN' && defaultTasaIva === 0) {
              setDefaultTasaIva(0.16)
              setDefaultImpuesto('IVA 16%')
            }
          }}
          onFechaChange={setFecha}
          onFechaRecepcionChange={setFechaRecepcion}
          onNotasChange={setNotas}
        />

        <SeccionAutollenado
          defaultRequisitor={defaultRequisitor}
          defaultEmpresa={defaultEmpresa}
          defaultUso={defaultUso}
          defaultOrdenTrabajoId={defaultOrdenTrabajoId}
          defaultUdm={defaultUdm}
          defaultTasaIva={defaultTasaIva}
          busquedaOtCabecera={busquedaOtCabecera}
          mostrarDropdownOt={mostrarDropdownOt}
          ordenesTrabajo={ordenesTrabajo}
          cargandoOTs={cargandoOTs}
          onRequisitorChange={setDefaultRequisitor}
          onEmpresaChange={setDefaultEmpresa}
          onUdmChange={setDefaultUdm}
          onTasaIvaChange={(tasa, impuesto) => {
            setDefaultTasaIva(tasa)
            setDefaultImpuesto(impuesto)
          }}
          onBusquedaOtChange={(v) => {
            setBusquedaOtCabecera(v)
            setDefaultUso(v)
            setDefaultOrdenTrabajo(v)
            setDefaultOrdenTrabajoId(null)
            setMostrarDropdownOt(true)
          }}
          onMostrarDropdownOt={setMostrarDropdownOt}
          onSeleccionarOt={seleccionarOtCabecera}
          onSeleccionarPreset={(opt) => {
            setDefaultUso(opt)
            setDefaultOrdenTrabajo('')
            setDefaultOrdenTrabajoId(null)
            setBusquedaOtCabecera(opt)
            if (opt === 'Stock' || opt === 'Taller' || opt === 'Herramientas') {
              setDefaultEmpresa('SMV')
            }
            setMostrarDropdownOt(false)
          }}
        />
      </div>

      <SeccionEntradaRapida
        textoPegado={textoPegado}
        extrayendoIa={extrayendoIa}
        fileInputRef={fileInputRef}
        fileInputIaRef={fileInputIaRef}
        onTextoChange={setTextoPegado}
        onPaste={handlePasteEvent}
        onProcesarTexto={() => procesarTextoPegado(textoPegado)}
        onFileUpload={handleFileUpload}
        onFileIaUpload={handleFileIaUpload}
        onAgregarFila={agregarFilaVacia}
      />

      <TablaPartidasCotizacion
        partidas={partidas}
        moneda={moneda}
        totales={totales}
        enviando={enviando}
        puedeCrear={puedeIntentarCrear}
        onActualizar={actualizarPartida}
        onSeleccionarOtFila={seleccionarOtFila}
        onEliminar={eliminarPartida}
        onLimpiar={limpiarTodo}
        onSolicitarCrear={solicitarCrear}
      />

      <DialogoConfirmarCotizacion
        open={mostrarConfirmacion}
        onOpenChange={setMostrarConfirmacion}
        enviando={enviando}
        proveedor={proveedor}
        proveedorId={proveedorId}
        referenciaProveedor={referenciaProveedor}
        moneda={moneda}
        fecha={fecha}
        fechaRecepcion={fechaRecepcion}
        itemsCount={partidas.length}
        totales={totales}
        onConfirmar={enviarAOdoo}
      />

      <datalist id="lista-ots-odoo">
        <option value="Stock" label="Stock SMV" />
        <option value="Mantenimiento" label="Mantenimiento General" />
        <option value="Taller" label="Operación Taller" />
        <option value="Herramientas" label="Herramientas de Taller" />
        {ordenesTrabajo.map((ot) => (
          <option
            key={ot.id}
            value={ot.name}
            label={`${ot.partnerName}${ot.clientOrderRef ? ` (PO: ${ot.clientOrderRef})` : ''}`}
          />
        ))}
      </datalist>
    </div>
  )
}
