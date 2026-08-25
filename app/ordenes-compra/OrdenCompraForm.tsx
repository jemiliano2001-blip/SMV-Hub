'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Printer,
  Mail,
  CheckCircle2,
  Send,
  Ban,
  PackageCheck,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { toast } from 'sonner'
import { obtenerProveedores } from '@/lib/proveedores'
import {
  crearOrdenCompraUsa,
  actualizarOrdenCompraUsa,
  cambiarEstadoOrdenCompraUsa,
  agregarNotaOrdenCompraUsa,
  registrarPOEnBitacoraOrdenes,
  calcularTotalesPO,
  generarSiguienteFolioPO,
  EMPRESA_USA_DEFAULT,
  DIRECCION_USA_DEFAULT,
  TERMINOS_PAGO_USA_OPCIONES,
  TERMINOS_PAGO_DEFAULT,
} from '@/lib/ordenes-compra-usa'
import { extraerPOUsaDesdeArchivo } from '@/lib/ordenes-compra-ia'
import { type MediaTypeFactura } from '@/lib/extraer-ia'
import { formatearMoneda } from '@/lib/format'
import type {
  OrdenCompraUsa,
  ItemOrdenCompraUsa,
  EstadoOrdenCompraUsa,
  Proveedor,
} from '@/lib/schemas'
import OrdenCompraImprimible from './components/OrdenCompraImprimible'
import ModalEnviarEmailPO from './components/ModalEnviarEmailPO'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

const ESTADOS_FLUJO: { id: EstadoOrdenCompraUsa; label: string; paso: number }[] = [
  { id: 'borrador', label: 'Borrador / RFQ', paso: 1 },
  { id: 'enviada', label: 'Petición Enviada', paso: 2 },
  { id: 'confirmada', label: 'Pedido de Compra', paso: 3 },
  { id: 'recibida', label: 'Recibido en Planta', paso: 4 },
]

const ITEM_VACIO: ItemOrdenCompraUsa = {
  producto: '',
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  impuestos: 0,
  subtotal: 0,
  fechaPlanificada: null,
  cuentaCargo: 'Stock',
  ordenTrabajo: '',
  claveProdServ: null,
}

interface OrdenCompraFormProps {
  ordenInicial?: OrdenCompraUsa | null
  onGuardadoExitoso?: (orden: OrdenCompraUsa) => void
  onCancelar?: () => void
}

export default function OrdenCompraForm({
  ordenInicial,
  onGuardadoExitoso,
  onCancelar,
}: OrdenCompraFormProps) {
  const confirmar = useConfirmDialog()
  const [proveedoresUsa, setProveedoresUsa] = useState<Proveedor[]>([])
  const [folioAuto, setFolioAuto] = useState(ordenInicial?.folio || '')
  const [guardando, setGuardando] = useState(false)
  const [extrayendoIA, setExtrayendoIA] = useState(false)
  const [mostrarImprimible, setMostrarImprimible] = useState(false)
  const [mostrarModalEmail, setMostrarModalEmail] = useState(false)
  const [notaNueva, setNotaNueva] = useState('')

  // Form State
  const [estado, setEstado] = useState<EstadoOrdenCompraUsa>(ordenInicial?.estado || 'borrador')
  const [proveedor, setProveedor] = useState(ordenInicial?.proveedor || '')
  const [proveedorId, setProveedorId] = useState<string | null>(ordenInicial?.proveedorId || null)
  const [referenciaProveedor, setReferenciaProveedor] = useState(ordenInicial?.referenciaProveedor || '')
  const [fechaPedido, setFechaPedido] = useState(
    ordenInicial?.fechaPedido || new Date().toISOString().slice(0, 10)
  )
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState(
    ordenInicial?.fechaEntregaEstimada || ''
  )
  const [moneda, setMoneda] = useState<'USD' | 'MXN'>(ordenInicial?.moneda || 'USD')
  const [comprador, setComprador] = useState(ordenInicial?.comprador || '')
  const [solicitante, setSolicitante] = useState(ordenInicial?.solicitante || '')
  const [empresa, setEmpresa] = useState(ordenInicial?.empresa || EMPRESA_USA_DEFAULT)
  const [cuentaCargo, setCuentaCargo] = useState(ordenInicial?.cuentaCargo || 'Stock')
  const [ordenTrabajo, setOrdenTrabajo] = useState(ordenInicial?.ordenTrabajo || '')
  const [shippingAddressUSA, setShippingAddressUSA] = useState(
    ordenInicial?.shippingAddressUSA || DIRECCION_USA_DEFAULT
  )
  const [brokerAduanal, setBrokerAduanal] = useState(ordenInicial?.brokerAduanal || '')
  const [terminosPago, setTerminosPago] = useState(ordenInicial?.terminosPago || TERMINOS_PAGO_DEFAULT)
  const [metodoEnvio, setMetodoEnvio] = useState(ordenInicial?.metodoEnvio || 'UPS Ground')
  const [notas, setNotas] = useState(ordenInicial?.notas || '')
  const [envio, setEnvio] = useState<number>(ordenInicial?.envio || 0)
  const [items, setItems] = useState<ItemOrdenCompraUsa[]>(
    ordenInicial?.items?.length ? ordenInicial.items : [{ ...ITEM_VACIO }]
  )
  const [ordenHubId, setOrdenHubId] = useState<string | null>(ordenInicial?.ordenHubId || null)
  const [historialNotas, setHistorialNotas] = useState(ordenInicial?.historialNotas || [])

  // Cargar lista de proveedores USA y folio inicial
  useEffect(() => {
    let activo = true
    async function init() {
      try {
        const provs = await obtenerProveedores()
        if (!activo) return
        const usaProvs = provs.filter(
          (p) =>
            p.mercado === 'usa' ||
            p.moneda === 'USD' ||
            !p.mercado ||
            p.pais?.toLowerCase().includes('estados unidos') ||
            p.pais?.toLowerCase().includes('usa')
        )
        setProveedoresUsa(usaProvs)
      } catch (err) {
        console.error('Error cargando proveedores:', err)
      }

      if (!ordenInicial?.folio) {
        const f = await generarSiguienteFolioPO()
        if (activo) {
          setFolioAuto(f)
        }
      }
    }
    init()
    return () => {
      activo = false
    }
  }, [ordenInicial])

  // Al seleccionar un proveedor, autocompletar términos y broker
  const handleSeleccionarProveedor = (nombre: string) => {
    setProveedor(nombre)
    const match = proveedoresUsa.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase().trim())
    if (match) {
      setProveedorId(match.id)
      if (match.brokerAduanal && !brokerAduanal) setBrokerAduanal(match.brokerAduanal)
      if (match.shippingAddressUSA && (!shippingAddressUSA || shippingAddressUSA === DIRECCION_USA_DEFAULT)) {
        setShippingAddressUSA(match.shippingAddressUSA)
      }
      if (match.metodosPago?.length && !terminosPago) {
        setTerminosPago(match.metodosPago.join(', '))
      }
    } else {
      setProveedorId(null)
    }
  }

  // Cálculos automáticos en tiempo real
  const calculos = useMemo(() => {
    return calcularTotalesPO(items, envio)
  }, [items, envio])

  // Manejo de partidas
  const handleItemChange = (
    index: number,
    campo: keyof ItemOrdenCompraUsa,
    valor: string | number | null | undefined
  ) => {
    setItems((prev) => {
      const copy = [...prev]
      const it = { ...copy[index], [campo]: valor }

      if (campo === 'cantidad' || campo === 'precioUnitario' || campo === 'impuestos') {
        const cant = Number(campo === 'cantidad' ? valor : it.cantidad) || 0
        const precio = Number(campo === 'precioUnitario' ? valor : it.precioUnitario) || 0
        it.subtotal = Math.round(cant * precio * 100) / 100
      }

      copy[index] = it
      return copy
    })
  }

  const handleAgregarItem = () => {
    setItems((prev) => [
      ...prev,
      {
        ...ITEM_VACIO,
        cuentaCargo: cuentaCargo || 'Stock',
        ordenTrabajo: ordenTrabajo || '',
      },
    ])
  }

  const handleDuplicarItem = (index: number) => {
    setItems((prev) => {
      const copy = [...prev]
      const duplicado = { ...copy[index] }
      copy.splice(index + 1, 0, duplicado)
      return copy
    })
    toast.success('Partida duplicada')
  }

  const handleEliminarItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ ...ITEM_VACIO }])
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Extracción IA con Gemini (/smv-extraer-ia)
  const handleCargarArchivoIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExtrayendoIA(true)
    const toastId = toast.loading('Analizando cotización con IA Gemini...')

    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string
          const base64 = res.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
      })
      reader.readAsDataURL(file)
      const base64 = await base64Promise

      const mediaType: MediaTypeFactura =
        file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg'
      const datos = await extraerPOUsaDesdeArchivo(base64, mediaType)

      if (datos.proveedor && !proveedor) {
        handleSeleccionarProveedor(datos.proveedor)
      }
      if (datos.referenciaProveedor) setReferenciaProveedor(datos.referenciaProveedor)
      if (datos.fechaPedido) setFechaPedido(datos.fechaPedido)
      if (datos.fechaEntregaEstimada) setFechaEntregaEstimada(datos.fechaEntregaEstimada)
      if (datos.moneda) setMoneda(datos.moneda)
      if (datos.envio) setEnvio(datos.envio)
      if (datos.terminosPago && !terminosPago) setTerminosPago(datos.terminosPago)
      if (datos.notas && !notas) setNotas(datos.notas)

      if (datos.items?.length > 0) {
        setItems(
          datos.items.map((it) => ({
            producto: it.producto || '',
            descripcion: it.descripcion || '',
            cantidad: it.cantidad || 1,
            precioUnitario: it.precioUnitario || 0,
            impuestos: it.impuestos || 0,
            subtotal: it.subtotal || 0,
            fechaPlanificada: datos.fechaEntregaEstimada || null,
            cuentaCargo: cuentaCargo || 'Stock',
            ordenTrabajo: ordenTrabajo || '',
            claveProdServ: null,
          }))
        )
      }

      toast.success('¡Cotización analizada y partidas cargadas con éxito!', { id: toastId })
    } catch (err: unknown) {
      console.error('Error extrayendo con IA:', err)
      toast.error(`No se pudo extraer la información: ${String(err)}`, { id: toastId })
    } finally {
      setExtrayendoIA(false)
      e.target.value = ''
    }
  }

  // Guardar / Actualizar Orden
  const handleGuardar = async (nuevoEstado?: EstadoOrdenCompraUsa) => {
    if (!proveedor.trim()) {
      toast.error('El nombre del proveedor es obligatorio')
      return
    }

    if (items.length === 0 || (items.length === 1 && !items[0].descripcion.trim())) {
      toast.error('Agrega al menos una partida con descripción')
      return
    }

    setGuardando(true)
    const estadoFinal = nuevoEstado || estado

    try {
      const payload = {
        folio: folioAuto,
        proveedor: proveedor.trim(),
        proveedorId,
        referenciaProveedor: referenciaProveedor.trim(),
        fechaPedido,
        fechaEntregaEstimada: fechaEntregaEstimada || null,
        moneda,
        estado: estadoFinal,
        comprador: comprador.trim(),
        solicitante: solicitante.trim(),
        empresa: empresa.trim(),
        cuentaCargo: cuentaCargo.trim(),
        ordenTrabajo: ordenTrabajo.trim(),
        shippingAddressUSA: shippingAddressUSA.trim() || DIRECCION_USA_DEFAULT,
        brokerAduanal: brokerAduanal.trim(),
        terminosPago: terminosPago.trim(),
        metodoEnvio: metodoEnvio.trim(),
        notas: notas.trim(),
        items,
        envio,
        ordenHubId,
      }

      let poId = ordenInicial?.id
      if (poId) {
        await actualizarOrdenCompraUsa(poId, payload)
        if (nuevoEstado && ordenInicial && nuevoEstado !== ordenInicial.estado) {
          await cambiarEstadoOrdenCompraUsa(poId, nuevoEstado)
        }
        toast.success(`Orden ${folioAuto} actualizada correctamente`)
      } else {
        const res = await crearOrdenCompraUsa(payload)
        poId = res.id
        toast.success(`Purchase Order ${res.folio} creada con éxito`)
      }

      setEstado(estadoFinal)

      if (onGuardadoExitoso) {
        onGuardadoExitoso({
          ...payload,
          id: poId,
          subtotal: calculos.subtotal,
          impuestos: calculos.impuestos,
          total: calculos.total,
          historialNotas,
          creadoPor: ordenInicial?.creadoPor || '',
          creadoEn: ordenInicial?.creadoEn || new Date(),
          actualizadoEn: new Date(),
        })
      }
    } catch (err: unknown) {
      console.error('Error al guardar PO:', err)
      toast.error(`Error guardando la orden: ${String(err)}`)
    } finally {
      setGuardando(false)
    }
  }

  // Registrar en bitácora de órdenes (/ordenes)
  const handleRegistrarEnBitacora = async () => {
    if (!ordenInicial?.id) {
      toast.error('Primero guarda la orden antes de registrarla en la bitácora')
      return
    }

    const ok = await confirmar({
      title: 'Registrar en bitácora de órdenes',
      description: `¿Deseas registrar la Purchase Order ${folioAuto} en la bitácora general de órdenes de SMV Hub? Quedará marcada como aprobada y recibida.`,
      confirmLabel: 'Registrar ahora',
      cancelLabel: 'Cancelar',
    })

    if (!ok) return

    setGuardando(true)
    try {
      const res = await registrarPOEnBitacoraOrdenes({
        id: ordenInicial.id,
        folio: folioAuto,
        proveedor,
        proveedorId,
        referenciaProveedor,
        fechaPedido,
        fechaEntregaEstimada: fechaEntregaEstimada || null,
        moneda,
        estado: 'recibida',
        comprador,
        solicitante,
        empresa,
        cuentaCargo,
        ordenTrabajo,
        shippingAddressUSA,
        brokerAduanal,
        terminosPago,
        metodoEnvio,
        notas,
        items,
        subtotal: calculos.subtotal,
        envio: calculos.envio,
        impuestos: calculos.impuestos,
        total: calculos.total,
        ordenHubId,
        cotizacionId: ordenInicial.cotizacionId || null,
        requisicionId: ordenInicial.requisicionId || null,
        historialNotas,
        creadoPor: ordenInicial.creadoPor || '',
        creadoEn: ordenInicial.creadoEn || new Date(),
        actualizadoEn: new Date(),
      })

      setOrdenHubId(res.ordenHubId)
      setEstado('recibida')
      toast.success(`¡Registrado con éxito en la bitácora general! ID: ${res.ordenHubId}`)
    } catch (err: unknown) {
      console.error('Error registrando en bitácora:', err)
      toast.error(`No se pudo registrar: ${String(err)}`)
    } finally {
      setGuardando(false)
    }
  }

  // Agregar nota en chatter
  const handleAgregarNota = async () => {
    if (!notaNueva.trim() || !ordenInicial?.id) return
    try {
      await agregarNotaOrdenCompraUsa(ordenInicial.id, notaNueva.trim())
      setHistorialNotas((prev) => [
        ...prev,
        {
          id: `nota-${Date.now()}`,
          fecha: new Date().toISOString(),
          autor: 'Tú',
          texto: notaNueva.trim(),
          tipo: 'nota',
        },
      ])
      setNotaNueva('')
      toast.success('Nota agregada al registro')
    } catch (err: unknown) {
      console.error('Error al agregar nota:', err)
      toast.error('Error al agregar nota')
    }
  }

  // Objeto para vista imprimible
  const ordenDataParaImpresion: OrdenCompraUsa = {
    id: ordenInicial?.id || 'temp',
    folio: folioAuto || 'PO-DRAFT',
    proveedor: proveedor || 'Proveedor no especificado',
    proveedorId,
    referenciaProveedor,
    fechaPedido,
    fechaEntregaEstimada: fechaEntregaEstimada || null,
    moneda,
    estado,
    comprador,
    solicitante,
    empresa,
    cuentaCargo,
    ordenTrabajo,
    shippingAddressUSA,
    brokerAduanal,
    terminosPago,
    metodoEnvio,
    notas,
    items,
    subtotal: calculos.subtotal,
    envio: calculos.envio,
    impuestos: calculos.impuestos,
    total: calculos.total,
    ordenHubId,
    cotizacionId: null,
    requisicionId: null,
    historialNotas,
    creadoPor: ordenInicial?.creadoPor || '',
    creadoEn: ordenInicial?.creadoEn || new Date(),
    actualizadoEn: new Date(),
  }

  if (mostrarImprimible) {
    return (
      <OrdenCompraImprimible
        orden={ordenDataParaImpresion}
        onCerrar={() => setMostrarImprimible(false)}
        onEnviarEmail={() => setMostrarModalEmail(true)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* ── BARRA SUPERIOR ESTILO ODOO (STATUS CHEVRONS & ACTIONS) ── */}
      <ModuleSurface className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Botones de Acción de Flujo */}
          <div className="flex flex-wrap items-center gap-2">
            {estado === 'borrador' && (
              <Button
                size="sm"
                onClick={() => handleGuardar('enviada')}
                disabled={guardando}
                className="cursor-pointer bg-primary font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                <Send className="mr-1.5 size-4" />
                Enviar al proveedor
              </Button>
            )}

            {(estado === 'borrador' || estado === 'enviada') && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleGuardar('confirmada')}
                disabled={guardando}
                className="cursor-pointer font-semibold shadow-xs"
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Confirmar pedido
              </Button>
            )}

            {estado === 'confirmada' && (
              <Button
                size="sm"
                variant="default"
                onClick={handleRegistrarEnBitacora}
                disabled={guardando || Boolean(ordenHubId)}
                className="cursor-pointer bg-emerald-600 font-semibold text-white hover:bg-emerald-700 shadow-xs"
              >
                <PackageCheck className="mr-1.5 size-4" />
                {ordenHubId ? 'Registrado en bitácora' : 'Recibir y registrar en bitácora'}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGuardar()}
              disabled={guardando}
              className="cursor-pointer"
            >
              {guardando ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Guardar
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setMostrarImprimible(true)}
              className="cursor-pointer"
            >
              <Printer className="mr-1.5 size-4" />
              Imprimir / PDF
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setMostrarModalEmail(true)}
              className="cursor-pointer"
            >
              <Mail className="mr-1.5 size-4" />
              Enviar por correo
            </Button>

            {onCancelar && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelar}
                disabled={guardando}
                className="cursor-pointer text-muted-foreground"
              >
                Volver
              </Button>
            )}

            {estado !== 'cancelada' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleGuardar('cancelada')}
                disabled={guardando}
                className="cursor-pointer text-muted-foreground hover:text-destructive"
              >
                <Ban className="mr-1.5 size-4" />
                Cancelar
              </Button>
            )}
          </div>

          {/* Stepper / Chevrons de Estado estilo Odoo */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs font-semibold">
            {ESTADOS_FLUJO.map((st) => {
              const esActual = estado === st.id
              const esPasado =
                ESTADOS_FLUJO.findIndex((s) => s.id === estado) >=
                ESTADOS_FLUJO.findIndex((s) => s.id === st.id)

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setEstado(st.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
                    esActual
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                      : esPasado
                      ? 'text-foreground hover:bg-muted font-medium'
                      : 'text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <span>{st.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </ModuleSurface>

      {/* ── ZONA DE EXTRACCIÓN CON IA GEMINI (/smv-extraer-ia) ── */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all hover:border-primary/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Extracción Inteligente de Cotización / Carrito USA
              </h3>
              <p className="text-xs text-muted-foreground">
                Arrastra un archivo PDF o captura de pantalla de McMaster, MSC, Shars, Grainger, etc. Gemini autocompletará el proveedor, partidas y precios.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">
              {extrayendoIA ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Extrayendo...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 size-4" />
                  Escanear PDF / Imagen
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={handleCargarArchivoIA}
                disabled={extrayendoIA}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── ENCABEZADO DE LA PURCHASE ORDER ── */}
      <ModuleSurface className="p-6">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Purchase Order USA
              </span>
              <h2 className="font-mono text-xl font-bold text-foreground">{folioAuto || 'PO-NUEVA'}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Moneda:</span>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as 'USD' | 'MXN')}
              className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="USD">USD ($)</option>
              <option value="MXN">MXN ($)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Proveedor con Autocomplete */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1">
              Proveedor (USA Tooling / Insumos) *
            </label>
            <input
              type="text"
              list="lista-proveedores-usa"
              value={proveedor}
              onChange={(e) => handleSeleccionarProveedor(e.target.value)}
              placeholder="Ej. McMaster-Carr, MSC Industrial, Shars Tool..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="lista-proveedores-usa">
              {proveedoresUsa.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.pais ? `${p.nombre} (${p.pais})` : p.nombre}
                </option>
              ))}
            </datalist>
          </div>

          {/* Ref / Quote # */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Referencia / Quote #
            </label>
            <input
              type="text"
              value={referenciaProveedor}
              onChange={(e) => setReferenciaProveedor(e.target.value)}
              placeholder="Ej. Q-987654 / Cart Ref"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Fecha de Pedido */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Fecha de Pedido
            </label>
            <input
              type="date"
              value={fechaPedido}
              onChange={(e) => setFechaPedido(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Solicitante / Requisitor */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Solicitante / Requisitor
            </label>
            <input
              type="text"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Nombre del solicitante"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Empresa / Destino */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Empresa / Destino
            </label>
            <select
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="RGV Metal and Plastics CO.">RGV Metal and Plastics CO. (USA)</option>
              <option value="SMV">SMV Industrial</option>
              <option value="AFX">AFX</option>
              <option value="GENERAL">General Planta</option>
            </select>
          </div>

          {/* Cuenta Cargo */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Cuenta Cargo
            </label>
            <input
              type="text"
              value={cuentaCargo}
              onChange={(e) => setCuentaCargo(e.target.value)}
              placeholder="Stock, Herramental, Proyecto..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Orden de Trabajo (OT) */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Orden de Trabajo (OT)
            </label>
            <input
              type="text"
              value={ordenTrabajo}
              onChange={(e) => setOrdenTrabajo(e.target.value)}
              placeholder="Ej. OT-2026-050"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Comprador */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Comprador / Buyer
            </label>
            <input
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del comprador"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Fecha Entrega Estimada */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Fecha de Entrega Estimada
            </label>
            <input
              type="date"
              value={fechaEntregaEstimada}
              onChange={(e) => setFechaEntregaEstimada(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Dirección USA (Ship To) */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-foreground mb-1">
              Dirección de Entrega USA (Ship To)
            </label>
            <input
              type="text"
              value={shippingAddressUSA}
              onChange={(e) => setShippingAddressUSA(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Broker Aduanal */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Broker Aduanal
            </label>
            <input
              type="text"
              value={brokerAduanal}
              onChange={(e) => setBrokerAduanal(e.target.value)}
              placeholder="Agencia o Broker en frontera"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Términos de Pago */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">
                Términos de Pago (Payment Terms)
              </label>
              <span className="text-[10px] text-muted-foreground font-medium">Principal: Crédito</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <select
                value={
                  TERMINOS_PAGO_USA_OPCIONES.some((o) => o.id === terminosPago)
                    ? terminosPago
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setTerminosPago(e.target.value)
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TERMINOS_PAGO_USA_OPCIONES.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
                <option value="custom">Otro / Personalizado...</option>
              </select>
              <input
                type="text"
                value={terminosPago}
                onChange={(e) => setTerminosPago(e.target.value)}
                placeholder="Ej. Credit (Net 30), Corporate Credit Card, Prepaid..."
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
          </div>

          {/* Método de Envío */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Método de Envío (Shipping)
            </label>
            <input
              type="text"
              value={metodoEnvio}
              onChange={(e) => setMetodoEnvio(e.target.value)}
              placeholder="UPS Ground, FedEx, Best Way..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </ModuleSurface>

      {/* ── TABLA DE PARTIDAS (ITEMS GRID) ── */}
      <ModuleSurface className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Partidas del Pedido ({items.length})</h3>
          <Button size="sm" variant="outline" onClick={handleAgregarItem} className="cursor-pointer">
            <Plus className="mr-1.5 size-4" />
            Agregar Partida
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3 min-w-[140px]">Part # / SKU</th>
                <th className="py-2.5 px-3 min-w-[240px]">Descripción *</th>
                <th className="py-2.5 px-3 w-24 text-right">Cant. *</th>
                <th className="py-2.5 px-3 w-28 text-right">P. Unit ({moneda})</th>
                <th className="py-2.5 px-3 w-24 text-right">Tax ({moneda})</th>
                <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                <th className="py-2.5 px-3 w-20 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-muted/20">
                  <td className="py-2 px-3 text-muted-foreground font-mono">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={it.producto}
                      onChange={(e) => handleItemChange(idx, 'producto', e.target.value)}
                      placeholder="SKU / Parte"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={it.descripcion}
                      onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción de la pieza o herramienta..."
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={it.cantidad}
                      onChange={(e) => handleItemChange(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="w-full text-right rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.precioUnitario}
                      onChange={(e) => handleItemChange(idx, 'precioUnitario', parseFloat(e.target.value) || 0)}
                      className="w-full text-right font-mono rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.impuestos}
                      onChange={(e) => handleItemChange(idx, 'impuestos', parseFloat(e.target.value) || 0)}
                      className="w-full text-right font-mono rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                    {formatearMoneda(it.subtotal, moneda)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicarItem(idx)}
                        title="Duplicar partida"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarItem(idx)}
                        title="Eliminar partida"
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── TOTALES Y RESUMEN FINANCIERO ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <label className="block text-xs font-semibold text-foreground mb-1">
              Notas e Instrucciones para el Proveedor:
            </label>
            <textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones de embarque, horarios de recepción, packing slip..."
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal Partidas:</span>
              <span className="font-mono font-semibold text-foreground">
                {formatearMoneda(calculos.subtotal, moneda)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Flete / Shipping ({moneda}):</span>
              <div className="w-28">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={envio}
                  onChange={(e) => setEnvio(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-mono rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Impuestos / Sales Tax ({moneda}):</span>
              <span className="font-mono font-semibold text-foreground">
                {formatearMoneda(calculos.impuestos, moneda)}
              </span>
            </div>

            <div className="border-t border-border pt-3 flex items-center justify-between text-base font-bold text-foreground">
              <span>Total General ({moneda}):</span>
              <span className="font-mono text-xl font-black text-primary">
                {formatearMoneda(calculos.total, moneda)}
              </span>
            </div>
          </div>
        </div>
      </ModuleSurface>

      {/* ── CHATTER / HISTORIAL DE NOTAS ESTILO ODOO ── */}
      {ordenInicial?.id && (
        <ModuleSurface className="p-6">
          <h3 className="mb-4 text-sm font-bold text-foreground">Historial y Registro de Actividad</h3>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={notaNueva}
              onChange={(e) => setNotaNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgregarNota()}
              placeholder="Escribe una nota interna para esta orden..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={handleAgregarNota} className="cursor-pointer">
              Agregar nota
            </Button>
          </div>

          <div className="space-y-3">
            {historialNotas.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay notas registradas todavía.</p>
            ) : (
              historialNotas.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-foreground">{n.autor}</span>
                    <span>{new Date(n.fecha).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-foreground whitespace-pre-line">{n.texto}</p>
                </div>
              ))
            )}
          </div>
        </ModuleSurface>
      )}

      {/* Modal para enviar correo */}
      <ModalEnviarEmailPO
        orden={ordenDataParaImpresion}
        open={mostrarModalEmail}
        onOpenChange={setMostrarModalEmail}
      />
    </div>
  )
}
