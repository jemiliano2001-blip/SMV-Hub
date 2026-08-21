'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles,
  UploadCloud,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getClienteAuth } from '@/lib/firebase'
import { obtenerProveedores } from '@/lib/proveedores'
import {
  crearCotizacion,
  claveDedupCotizacion,
  clavesExistentes,
} from '@/lib/cotizaciones'
import type { Cotizacion, EstatusCotizacion, Proveedor, Ubicacion } from '@/lib/schemas'
import type { CotizacionExtraida } from '@/lib/cotizaciones-extraer-ia'

interface CotizacionIaModalProps {
  open: boolean
  onClose: () => void
  onSaved: (cotizacion: Cotizacion) => void
  initialFile?: File | null
}

function obtenerSolicitanteInicial(): string {
  try {
    const user = getClienteAuth().currentUser
    if (user?.displayName) return user.displayName
    if (user?.email) {
      const nom = user.email.split('@')[0]
      return nom.charAt(0).toUpperCase() + nom.slice(1)
    }
  } catch {
    // Ignorar si auth aún no carga
  }
  return ''
}

export default function CotizacionIaModal({
  open,
  onClose,
  onSaved,
  initialFile = null,
}: CotizacionIaModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [catalogoProveedores, setCatalogoProveedores] = useState<readonly Proveedor[]>([])

  const [linkInput, setLinkInput] = useState('')
  const [extraidoExitoso, setExtraidoExitoso] = useState(false)

  const [formData, setFormData] = useState(() => ({
    solicitante: obtenerSolicitanteInicial(),
    fecha: new Date().toISOString().slice(0, 10),
    estatus: 'cotizado' as EstatusCotizacion,
    ubicacion: 'USA' as Ubicacion,
    moneda: 'USD' as 'USD' | 'MXN',
    proveedor: '',
    proveedorId: null as string | null,
    numeroParte: '',
    descripcion: '',
    cantidad: '1',
    precioUnitario: '',
    total: '',
    diasHabiles: '',
    link: '',
    notas: '',
  }))

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropzoneRef = useRef<HTMLDivElement | null>(null)
  const archivoProcesadoRef = useRef<File | null>(null)

  // Cargar catálogo de proveedores
  useEffect(() => {
    let cancel = false
    void obtenerProveedores().then((p: Proveedor[]) => {
      if (!cancel) setCatalogoProveedores(p)
    })
    return () => {
      cancel = true
    }
  }, [])

  const aplicarDatosExtraidos = useCallback((datos: CotizacionExtraida, fallbackLink?: string) => {
    setFormData((prev) => {
      const cant = datos.cantidad ?? 1
      const pUnit = datos.precioUnitario !== null ? String(datos.precioUnitario) : ''
      const tot =
        datos.total !== null
          ? String(datos.total)
          : datos.precioUnitario !== null
          ? String(datos.precioUnitario * cant)
          : ''

      return {
        ...prev,
        numeroParte: datos.numeroParte || '',
        descripcion: datos.descripcion || '',
        proveedor: datos.proveedor || '',
        precioUnitario: pUnit,
        cantidad: String(cant),
        total: tot,
        moneda: datos.moneda,
        ubicacion: datos.ubicacion,
        diasHabiles: datos.diasHabiles || '',
        link: datos.link || fallbackLink || prev.link,
        notas: datos.notas
          ? datos.marca
            ? `Marca: ${datos.marca} | ${datos.notas}`
            : datos.notas
          : datos.marca
          ? `Marca: ${datos.marca}`
          : '',
      }
    })
    setExtraidoExitoso(true)
  }, [])

  const procesarArchivo = useCallback(
    async (file: File, urlReferencia?: string) => {
      if (!file) return

      const tiposPermitidos = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/jpg',
        'application/pdf',
      ]

      if (!tiposPermitidos.includes(file.type)) {
        toast.error('Formato no soportado. Sube una captura PNG, JPG, WebP o PDF.')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('La imagen no puede exceder los 10 MB.')
        return
      }

      setError(null)
      setProcesando(true)

      // Vista previa local si es imagen
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file)
        setImagePreview(previewUrl)
      } else {
        setImagePreview(null)
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const res = reader.result as string
            const idx = res.indexOf('base64,')
            resolve(idx !== -1 ? res.substring(idx + 7) : res)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const auth = getClienteAuth()
        const token = await auth.currentUser?.getIdToken()
        if (!token) {
          throw new Error('Debes iniciar sesión para usar la extracción con IA.')
        }

        const res = await fetch('/api/cotizaciones/extraer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            base64,
            mimeType: file.type,
            link: urlReferencia?.trim() || linkInput.trim() || null,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Error al procesar la captura con Gemini')
        }

        aplicarDatosExtraidos(data.datos, urlReferencia || linkInput)
        toast.success('¡Información del producto extraída exitosamente!')
      } catch (err) {
        console.error('Error extrayendo cotización:', err)
        const msg = err instanceof Error ? err.message : 'Error al extraer información de la captura'
        setError(msg)
        toast.error(msg)
      } finally {
        setProcesando(false)
      }
    },
    [aplicarDatosExtraidos, linkInput]
  )

  // Procesar archivo inicial si viene de un Ctrl+V global
  useEffect(() => {
    if (initialFile && open && archivoProcesadoRef.current !== initialFile) {
      archivoProcesadoRef.current = initialFile
      const timer = window.setTimeout(() => {
        void procesarArchivo(initialFile)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [initialFile, open, procesarArchivo])

  // Listener para Ctrl+V dentro del modal
  useEffect(() => {
    if (!open) return

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void procesarArchivo(file)
            break
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [open, procesarArchivo])

  // Recalcular total cuando cambia cantidad o precio
  const handleCantidadChange = (val: string) => {
    const cantNum = parseFloat(val)
    const pUnitNum = parseFloat(formData.precioUnitario)
    const nuevoTotal =
      !isNaN(cantNum) && !isNaN(pUnitNum) ? String((cantNum * pUnitNum).toFixed(2)) : formData.total
    setFormData((prev) => ({ ...prev, cantidad: val, total: nuevoTotal }))
  }

  const handlePrecioUnitarioChange = (val: string) => {
    const cantNum = parseFloat(formData.cantidad)
    const pUnitNum = parseFloat(val)
    const nuevoTotal =
      !isNaN(cantNum) && !isNaN(pUnitNum) ? String((cantNum * pUnitNum).toFixed(2)) : formData.total
    setFormData((prev) => ({ ...prev, precioUnitario: val, total: nuevoTotal }))
  }

  const handleProveedorChange = (nombre: string) => {
    const match = catalogoProveedores.find(
      (p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase()
    )
    setFormData((prev) => ({
      ...prev,
      proveedor: nombre,
      proveedorId: match?.id ?? null,
      ubicacion: match?.ubicacion ? (match.ubicacion as Ubicacion) : prev.ubicacion,
    }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void procesarArchivo(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.descripcion.trim()) {
      setError('La descripción del producto es requerida.')
      return
    }
    if (!formData.proveedor.trim()) {
      setError('El proveedor es requerido.')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const cantNum = parseFloat(formData.cantidad)
      const pUnitNum = parseFloat(formData.precioUnitario)
      const totNum = parseFloat(formData.total)

      const payload = {
        solicitante: formData.solicitante.trim() || 'General',
        fecha: formData.fecha || new Date().toISOString().slice(0, 10),
        estatus: formData.estatus,
        ubicacion: formData.ubicacion,
        moneda: formData.moneda,
        proveedor: formData.proveedor.trim(),
        proveedorId: formData.proveedorId,
        numeroParte: formData.numeroParte.trim() || null,
        descripcion: formData.descripcion.trim(),
        cantidad: !isNaN(cantNum) ? cantNum : null,
        precioUnitario: !isNaN(pUnitNum) ? pUnitNum : null,
        total: !isNaN(totNum) ? totNum : !isNaN(cantNum) && !isNaN(pUnitNum) ? cantNum * pUnitNum : null,
        diasHabiles: formData.diasHabiles.trim() || null,
        link: formData.link.trim() || null,
        notas: formData.notas.trim() || null,
      }

      const claveNueva = claveDedupCotizacion(payload)
      const existentes = await clavesExistentes()
      if (existentes.has(claveNueva)) {
        setError('Ya existe una cotización idéntica con el mismo proveedor, descripción, no. de parte y fecha.')
        setGuardando(false)
        return
      }

      const id = await crearCotizacion(payload)
      toast.success('Cotización guardada exitosamente')
      onSaved({
        ...payload,
        id,
        llavePieza: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      } as Cotizacion)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar la cotización. Revisa los datos.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Extraer Cotización con IA</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pega un screenshot con <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">Ctrl + V</kbd> o arrastra la imagen de la tienda o catálogo.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
              <Sparkles className="h-3 w-3" />
              Gemini Vision 3.7
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-12">
          {/* Columna Izquierda: Dropzone y Captura */}
          <div className="flex flex-col gap-4 border-b border-border p-5 md:col-span-5 md:border-b-0 md:border-r bg-muted/10">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Screenshot / Captura de producto
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void procesarArchivo(file)
                }}
              />

              <div
                ref={dropzoneRef}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : procesando
                    ? 'border-primary/40 bg-muted/40'
                    : 'border-border hover:border-primary/60 hover:bg-muted/40 bg-background'
                }`}
              >
                {procesando ? (
                  <div className="flex flex-col items-center gap-2.5 p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-foreground">Analizando captura con Gemini...</p>
                    <p className="text-[11px] text-muted-foreground">Extrayendo SKU, descripción, precio y moneda</p>
                  </div>
                ) : imagePreview ? (
                  <div className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Screenshot de cotización"
                      className="max-h-[180px] w-auto rounded object-contain shadow-sm transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Cambiar o pegar otra imagen
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Haz clic o arrastra un screenshot aquí
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        O presiona <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] font-bold">Ctrl + V</kbd>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input para URL de referencia complementaria */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Enlace / URL de la tienda (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://proveedor.com/producto..."
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value)
                    setFormData((prev) => ({ ...prev, link: e.target.value }))
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ayuda a la IA a verificar el origen y guarda el enlace directo en la cotización.
              </p>
            </div>

            {extraidoExitoso && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Datos detectados por IA</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Revisa los campos a la derecha antes de guardar. Puedes ajustar cualquier valor.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Formulario de revisión y edición */}
          <div className="p-6 md:col-span-7">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form id="cotizacion-ia-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Proveedor y Moneda */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Proveedor / Tienda *
                  </label>
                  <input
                    required
                    list="catalogo-proveedores-ia"
                    value={formData.proveedor}
                    onChange={(e) => handleProveedorChange(e.target.value)}
                    placeholder="Ej. Rockwell, McMaster-Carr, Grainger..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                  <datalist id="catalogo-proveedores-ia">
                    {catalogoProveedores.map((p) => (
                      <option key={p.id} value={p.nombre} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Moneda / País
                  </label>
                  <div className="flex rounded-lg border border-input bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, moneda: 'USD', ubicacion: 'USA' }))
                      }
                      className={`flex-1 rounded-md py-1.5 font-semibold transition-colors ${
                        formData.moneda === 'USD'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      USD (USA)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, moneda: 'MXN', ubicacion: 'MX' }))
                      }
                      className={`flex-1 rounded-md py-1.5 font-semibold transition-colors ${
                        formData.moneda === 'MXN'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      MXN (MX)
                    </button>
                  </div>
                </div>
              </div>

              {/* No de Parte y Descripción */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    No. de Parte / SKU
                  </label>
                  <input
                    value={formData.numeroParte}
                    onChange={(e) => setFormData({ ...formData, numeroParte: e.target.value })}
                    placeholder="Ej. 140M-C2E-C16"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Descripción / Producto *
                  </label>
                  <input
                    required
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción clara del producto..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Precios y Cantidad */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Cantidad</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.cantidad}
                    onChange={(e) => handleCantidadChange(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    P. Unitario ({formData.moneda})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.precioUnitario}
                    onChange={(e) => handlePrecioUnitarioChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Total ({formData.moneda})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.total}
                    onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Tiempo entrega
                  </label>
                  <input
                    placeholder="Ej. En stock (2-3 días)"
                    value={formData.diasHabiles}
                    onChange={(e) => setFormData({ ...formData, diasHabiles: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Solicitante y Fecha */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Solicitante</label>
                  <input
                    value={formData.solicitante}
                    onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Estatus</label>
                  <select
                    value={formData.estatus}
                    onChange={(e) =>
                      setFormData({ ...formData, estatus: e.target.value as EstatusCotizacion })
                    }
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="cotizado">Cotizado</option>
                    <option value="revisar">Revisar</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Link directo */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Enlace / Link del producto
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none font-mono"
                  />
                  {formData.link && /^https?:\/\//i.test(formData.link) && (
                    <a
                      href={formData.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/30 px-3 hover:bg-muted text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Notas y Especificaciones */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Notas / Especificaciones técnicas
                </label>
                <textarea
                  rows={2}
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Detalles técnicos, voltaje, dimensiones, marca detectada..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </form>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" form="cotizacion-ia-form" disabled={guardando || procesando}>
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5 text-amber-300" />
            )}
            {guardando ? 'Guardando...' : 'Guardar Cotización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
