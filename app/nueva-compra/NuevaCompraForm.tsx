'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2, Upload, X, AlertTriangle, FileText } from 'lucide-react'
import { z } from 'zod'
import { getClienteAuth } from '@/lib/firebase'
import { buscarPorFacturaYProveedor, listarOrdenes } from '@/lib/ordenes'
import { esOrdenDuplicada } from '@/lib/importar'
import { validarCuadreFactura, validarImpuestoTexas } from '@/lib/factura-montos'
import {
  aplanarHistorial,
  completarCamposItem,
  type ItemHistorico,
} from '@/lib/sugerencias-compra'
import {
  NuevaCompraFormSchema,
  type NuevaCompraForm,
  type ExtraccionInvoice,
  type ItemFactura,
} from '@/lib/schemas'

type FormInput = z.input<typeof NuevaCompraFormSchema>

const ITEM_VACIO: ItemFactura = {
  descripcion: '',
  descripcionSimplificada: '',
  cantidad: null,
  precioUnitario: null,
  total: null,
  claveProdServ: null,
  satPendiente: true,
  empresa: '',
  cuentaCargo: '',
  requisitor: '',
  ordenTrabajo: '',
}

const cls = {
  input: 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50',
  inputSm: 'w-full min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50',
  label: 'block text-sm font-medium text-gray-700 mb-1',
  error: 'text-xs text-red-500 mt-1',
  section: 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm',
  heading: 'text-base font-semibold text-gray-900 mb-4',
}

const ACCEPT_FACTURA = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const MAX_BYTES_FACTURA = 10 * 1024 * 1024

function esArchivoFacturaValido(file: File): boolean {
  return (
    (file.type.startsWith('image/') || file.type === 'application/pdf') &&
    file.size <= MAX_BYTES_FACTURA
  )
}

export default function NuevaCompraForm({
  onSubmit: onExternalSubmit,
  initialDescripcion,
}: {
  onSubmit?: (data: NuevaCompraForm, imagen?: File) => Promise<void>
  initialDescripcion?: string
}) {
  const [imagen, setImagen] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null)
  const [extraido, setExtraido] = useState(false)
  const [duplicadoDetectado, setDuplicadoDetectado] = useState<string | null>(null)
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const dropzoneRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const historialRef = useRef<ItemHistorico[]>([])
  const [historialListo, setHistorialListo] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, NuevaCompraForm>({
    resolver: zodResolver(NuevaCompraFormSchema),
    defaultValues: {
      moneda: 'USD',
      envio: null,
      items: [{ ...ITEM_VACIO, descripcion: initialDescripcion ?? ITEM_VACIO.descripcion }],
      requisitor: '',
      ordenTrabajo: '',
      empresa: '',
      cuentaCargo: '',
      destino: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const proveedorWatch = useWatch({ control, name: 'proveedor' })
  const numeroFacturaWatch = useWatch({ control, name: 'numeroFactura' })
  const itemsWatch = useWatch({ control, name: 'items' })
  const subtotalWatch = useWatch({ control, name: 'subtotal' })
  const envioWatch = useWatch({ control, name: 'envio' })
  const impuestosWatch = useWatch({ control, name: 'impuestos' })
  const totalWatch = useWatch({ control, name: 'total' })

  const advertenciasMontos = useMemo(() => {
    const montos = {
      subtotal: subtotalWatch ?? null,
      envio: envioWatch ?? null,
      impuestos: impuestosWatch ?? null,
      total: totalWatch ?? null,
    }
    const adv: string[] = []
    const cuadre = validarCuadreFactura(montos)
    if (!cuadre.cuadra && cuadre.mensaje) adv.push(cuadre.mensaje)
    const tax = validarImpuestoTexas(montos)
    if (!tax.coherente && tax.mensaje) adv.push(tax.mensaje)
    return adv
  }, [subtotalWatch, envioWatch, impuestosWatch, totalWatch])

  const verificarDuplicado = useCallback(async (proveedor: string, numeroFactura: string) => {
    const nf = numeroFactura?.trim()
    const prov = proveedor?.trim()
    if (!nf || !prov) {
      setDuplicadoDetectado(null)
      return
    }

    setVerificandoDuplicado(true)
    try {
      const existentes = await buscarPorFacturaYProveedor([
        { numeroFactura: nf, proveedor: prov },
      ])
      if (esOrdenDuplicada(nf, prov, existentes)) {
        setDuplicadoDetectado(`${prov} / factura ${nf}`)
      } else {
        setDuplicadoDetectado(null)
      }
    } catch (err) {
      console.error('Error verificando factura duplicada:', err)
      setDuplicadoDetectado(null)
    } finally {
      setVerificandoDuplicado(false)
    }
  }, [])

  useEffect(() => {
    const nf = typeof numeroFacturaWatch === 'string' ? numeroFacturaWatch : ''
    const prov = typeof proveedorWatch === 'string' ? proveedorWatch : ''
    const timer = window.setTimeout(() => {
      void verificarDuplicado(prov, nf)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [proveedorWatch, numeroFacturaWatch, verificarDuplicado])

  // Carga el historial de órdenes una vez para alimentar las sugerencias.
  useEffect(() => {
    let activo = true
    listarOrdenes()
      .then((ordenes) => {
        if (activo) historialRef.current = aplanarHistorial(ordenes)
      })
      .catch((err) => {
        console.error('[nueva-compra] no se pudo cargar el historial para sugerencias:', err)
      })
      .finally(() => {
        if (activo) setHistorialListo(true)
      })
    return () => {
      activo = false
    }
  }, [])

  // Auto-rellena empresa/cuentaCargo/requisitor vacíos al editar descripción o proveedor.
  // Respeta lo que ya tenga el campo (incluido lo extraído por la IA).
  useEffect(() => {
    if (extrayendo) return
    const timer = window.setTimeout(() => {
      const proveedor = typeof getValues('proveedor') === 'string' ? getValues('proveedor')! : ''
      const items = getValues('items') ?? []
      items.forEach((item, i) => {
        const faltan =
          !item.empresa?.trim() || !item.cuentaCargo?.trim() || !item.requisitor?.trim()
        if (!faltan) return
        const sug = completarCamposItem(item, proveedor, historialRef.current)
        if (!item.empresa?.trim() && sug.empresa) {
          setValue(`items.${i}.empresa`, sug.empresa, { shouldDirty: true })
        }
        if (!item.cuentaCargo?.trim() && sug.cuentaCargo) {
          setValue(`items.${i}.cuentaCargo`, sug.cuentaCargo, { shouldDirty: true })
        }
        if (!item.requisitor?.trim() && sug.requisitor) {
          setValue(`items.${i}.requisitor`, sug.requisitor, { shouldDirty: true })
        }
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [itemsWatch, proveedorWatch, extrayendo, historialListo, getValues, setValue])

  function numReg(name: Parameters<typeof register>[0]) {
    return register(name, {
      setValueAs: (v: string) => (v === '' || v === null || v === undefined ? null : Number(v)),
    })
  }

  const procesarArchivoFactura = useCallback(async (file: File) => {
    if (!esArchivoFacturaValido(file)) {
      setErrorExtraccion(
        file.size > MAX_BYTES_FACTURA
          ? 'El archivo no puede exceder 10 MB'
          : 'Formato no válido. Usa JPG, PNG, WEBP o PDF'
      )
      return
    }

    // Snapshot a memoria: si el archivo original vive en una carpeta sincronizada
    // (OneDrive Files On-Demand, unidad de red, etc.), Chrome puede perder acceso
    // a sus bytes en disco si el usuario tarda en llenar el formulario antes de
    // guardar (net::ERR_FILE_NOT_FOUND al subir). El snapshot ya no depende de
    // que el archivo original siga disponible.
    const bytes = await file.arrayBuffer()
    const archivo = new File([bytes], file.name, { type: file.type })

    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(archivo)
    })
    setImagen(archivo)
    setErrorExtraccion(null)
    setExtraido(false)
    setExtrayendo(true)

    try {
      const token = await getClienteAuth().currentUser?.getIdToken()
      if (!token) {
        setErrorExtraccion('Inicia sesión para extraer datos de la factura')
        return
      }

      const fd = new FormData()
      fd.append('imagen', archivo)
      const res = await fetch('/api/extraer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorExtraccion(data.error ?? 'Error al extraer datos de la factura')
        return
      }

      const ext = data as ExtraccionInvoice
      const itemsBase =
        ext.items.length > 0
          ? ext.items.map((item) => ({
              ...ITEM_VACIO,
              ...item,
              empresa: item.empresa ?? '',
              cuentaCargo: item.cuentaCargo ?? '',
              requisitor: item.requisitor ?? '',
              ordenTrabajo: item.ordenTrabajo ?? '',
            }))
          : [{ ...ITEM_VACIO }]

      // Lo que extrajo la IA manda; sugerimos solo los campos que quedaron vacíos.
      const items = itemsBase.map((item) => ({
        ...item,
        ...completarCamposItem(item, ext.proveedor ?? '', historialRef.current),
      }))

      reset({
        proveedor: ext.proveedor,
        numeroFactura: ext.numeroFactura ?? '',
        fechaFactura: ext.fechaFactura ?? '',
        moneda: ext.moneda,
        subtotal: ext.subtotal,
        envio: ext.envio ?? null,
        impuestos: ext.impuestos,
        total: ext.total,
        items,
        requisitor: '',
        ordenTrabajo: '',
        empresa: '',
        cuentaCargo: '',
        destino: '',
      })
      setExtraido(true)
      if (ext.numeroFactura && ext.proveedor) {
        await verificarDuplicado(ext.proveedor, ext.numeroFactura)
      }
    } catch {
      setErrorExtraccion('Error de red al contactar la API')
    } finally {
      setExtrayendo(false)
    }
  }, [reset, verificarDuplicado])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    void procesarArchivoFactura(file)
    e.target.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void procesarArchivoFactura(file)
  }, [procesarArchivoFactura])

  useEffect(() => {
    if (imagen) return

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          void procesarArchivoFactura(file)
          break
        }
      }
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [imagen, procesarArchivoFactura])

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImagen(null)
    setPreviewUrl(null)
    setExtraido(false)
    setErrorExtraccion(null)
    setDuplicadoDetectado(null)
    reset({
      moneda: 'USD',
      items: [{ ...ITEM_VACIO }],
      requisitor: '',
      ordenTrabajo: '',
      empresa: '',
      cuentaCargo: '',
      destino: '',
    })
  }

  async function onSubmit(data: NuevaCompraForm) {
    if (duplicadoDetectado) return
    await onExternalSubmit?.(data, imagen ?? undefined)
  }

  const itemsError =
    typeof errors.items?.message === 'string' ? errors.items.message : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Archivo de factura ──────────────────────────────────────── */}
      <section className={cls.section}>
        <h2 className={cls.heading}>Factura <span className="font-normal text-gray-500">(opcional)</span></h2>
        <p className="mb-4 text-sm text-gray-500">
          Sube una imagen o PDF de la factura y la IA intentará extraer los datos (incluyendo Your reference por ítem en McMaster-Carr).
          También puedes capturar la compra manualmente.
        </p>

        {!imagen ? (
          <div
            ref={dropzoneRef}
            tabIndex={0}
            role="button"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              dragActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <span className="text-sm text-gray-500">Haz clic, arrastra o pega una imagen o PDF</span>
            <span className="text-xs text-gray-400">JPG · PNG · WEBP · PDF</span>
            <span className="mt-1 text-xs text-blue-600">Clic en esta zona para seleccionar archivo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FACTURA}
              onChange={handleImageChange}
              className="sr-only"
            />
          </div>
        ) : (
          <div className="relative">
            {imagen.type === 'application/pdf' ? (
              <div className="flex max-h-72 flex-col items-center justify-center gap-3 rounded-lg bg-gray-50 p-8">
                <FileText className="h-12 w-12 text-red-500" />
                <p className="text-sm font-medium text-gray-800">{imagen.name}</p>
                <iframe
                  src={previewUrl!}
                  title="Vista previa PDF"
                  className="mt-2 h-48 w-full rounded border border-gray-200 bg-white"
                />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl!} alt="Factura" className="max-h-72 w-full rounded-lg object-contain bg-gray-50" />
            )}
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 rounded-full bg-white p-1 shadow-md hover:bg-gray-100"
              aria-label="Quitar archivo"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
            {extrayendo && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/80">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Extrayendo datos con IA…</span>
              </div>
            )}
          </div>
        )}

        {errorExtraccion && (
          <p className="mt-3 text-sm text-red-600">⚠ {errorExtraccion}</p>
        )}
      </section>

      {/* ── Datos de la factura ──────────────────────────────────────── */}
      <section className={cls.section}>
        <h2 className={cls.heading}>
          Datos de la factura
          {extraido && <span className="ml-2 text-xs font-normal text-green-600">✓ Extraído por IA — revisa y corrige si es necesario</span>}
        </h2>

        {duplicadoDetectado && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-900">Esta factura ya está registrada</p>
              <p className="text-sm text-yellow-800 mt-1">
                {duplicadoDetectado} ya existe en órdenes. Corrige el número de factura o el proveedor
                si extrajo mal la IA, o revisa el listado en{' '}
                <a href="/ordenes" className="underline font-medium hover:text-yellow-950">
                  Órdenes
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {verificandoDuplicado && !duplicadoDetectado && (
          <p className="mb-3 text-xs text-gray-500 flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verificando si la factura ya existe…
          </p>
        )}

        {advertenciasMontos.length > 0 && (
          <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-yellow-900">Revisa los montos de la factura</p>
              <p className="text-xs text-yellow-800">
                El total debe cuadrar: <strong>subtotal + envío + impuestos = total</strong>.
                En Texas el tax (~8.25%) suele aplicarse sobre mercancía y envío.
              </p>
              <ul className="text-sm text-yellow-800 list-disc pl-4 mt-1">
                {advertenciasMontos.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={cls.label}>Proveedor *</label>
            <input {...register('proveedor')} className={cls.input} placeholder="Nombre del proveedor" disabled={extrayendo} />
            {errors.proveedor && <p className={cls.error}>{errors.proveedor.message}</p>}
          </div>

          <div>
            <label className={cls.label}>N° Factura</label>
            <input {...register('numeroFactura')} className={cls.input} placeholder="INV-001" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Fecha de factura</label>
            <input {...register('fechaFactura')} type="date" className={cls.input} disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Moneda</label>
            <input {...register('moneda')} className={cls.input} placeholder="USD" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Subtotal (mercancía)</label>
            <input {...numReg('subtotal')} type="number" step="any" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Envío / Shipping</label>
            <input {...numReg('envio')} type="number" step="any" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Impuestos / Tax (~8.25% TX)</label>
            <input {...numReg('impuestos')} type="number" step="any" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>

          <div>
            <label className={cls.label}>Total</label>
            <input {...numReg('total')} type="number" step="any" min="0" className={cls.input} placeholder="0.00" disabled={extrayendo} />
          </div>
        </div>
      </section>

      {/* ── Ítems (captura línea por línea) ──────────────────────────── */}
      <section className={cls.section}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cls.heading + ' mb-0'}>Ítems de la factura</h2>
          <button
            type="button"
            onClick={() => append({ ...ITEM_VACIO })}
            disabled={extrayendo}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Añadir ítem
          </button>
        </div>

        {itemsError && <p className={cls.error + ' mb-3'}>{itemsError}</p>}

        <div className="space-y-4">
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ítem {i + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={extrayendo}
                    className="p-1 text-red-400 hover:text-red-600 rounded"
                    aria-label={`Quitar ítem ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div>
                <label className={cls.label}>Descripción</label>
                <input {...register(`items.${i}.descripcion`)} className={cls.input} disabled={extrayendo} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={cls.label}>Cant.</label>
                  <input {...numReg(`items.${i}.cantidad`)} type="number" step="1" min="0" className={cls.input} disabled={extrayendo} />
                </div>
                <div>
                  <label className={cls.label}>P. unitario</label>
                  <input {...numReg(`items.${i}.precioUnitario`)} type="number" step="any" min="0" className={cls.input} disabled={extrayendo} />
                </div>
                <div>
                  <label className={cls.label}>Total</label>
                  <input {...numReg(`items.${i}.total`)} type="number" step="any" min="0" className={cls.input} disabled={extrayendo} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-200">
                <div>
                  <label className={cls.label}>Empresa / destino *</label>
                  <input
                    {...register(`items.${i}.empresa`)}
                    className={cls.input}
                    placeholder="APX / OHD / SMV"
                    disabled={extrayendo}
                  />
                  {errors.items?.[i]?.empresa && (
                    <p className={cls.error}>{errors.items[i]?.empresa?.message}</p>
                  )}
                </div>
                <div>
                  <label className={cls.label}>Cuenta cargo (SO)</label>
                  <input
                    {...register(`items.${i}.cuentaCargo`)}
                    className={cls.input}
                    placeholder="SO1148"
                    disabled={extrayendo}
                  />
                </div>
                <div>
                  <label className={cls.label}>Requisitor *</label>
                  <input
                    {...register(`items.${i}.requisitor`)}
                    className={cls.input}
                    placeholder="Nombre completo"
                    disabled={extrayendo}
                  />
                  {errors.items?.[i]?.requisitor && (
                    <p className={cls.error}>{errors.items[i]?.requisitor?.message}</p>
                  )}
                </div>
                <div>
                  <label className={cls.label}>Orden de trabajo</label>
                  <input
                    {...register(`items.${i}.ordenTrabajo`)}
                    className={cls.input}
                    placeholder="OT-100"
                    disabled={extrayendo}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <button
          type="submit"
          disabled={extrayendo || isSubmitting || verificandoDuplicado || Boolean(duplicadoDetectado)}
          className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
            </span>
          ) : verificandoDuplicado ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
            </span>
          ) : duplicadoDetectado ? (
            'Factura duplicada — no se puede guardar'
          ) : (
            'Guardar compra'
          )}
        </button>
      </div>
    </form>
  )
}
