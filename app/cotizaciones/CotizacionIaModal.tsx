'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Sparkles,
  UploadCloud,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { getClienteAuth } from '@/lib/firebase'
import { obtenerProveedores } from '@/lib/proveedores'
import {
  crearCotizacionesLote,
  claveDedupCotizacion,
  clavesExistentes,
  type NuevaCotizacionPayload,
} from '@/lib/cotizaciones'
import type { Cotizacion, EstatusCotizacion, Proveedor, Ubicacion } from '@/lib/schemas'
import type { CotizacionExtraidaItem, ExtraccionCotizacionMulti } from '@/lib/cotizaciones-extraer-ia'
import { fechaHoyLocal, formatPrecio } from '@/lib/format'

interface CotizacionIaModalProps {
  open: boolean
  onClose: () => void
  onSaved: (cotizacion: Cotizacion) => void
  onSavedLote?: (cotizaciones: Cotizacion[]) => void
  initialFile?: File | null
}

export interface FilaPartidaIa extends CotizacionExtraidaItem {
  idTemp: string
  seleccionada: boolean
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
  onSavedLote,
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

  // Metadatos generales
  const [generalData, setGeneralData] = useState(() => ({
    solicitante: obtenerSolicitanteInicial(),
    fecha: fechaHoyLocal(),
    estatus: 'cotizado' as EstatusCotizacion,
    ubicacion: 'USA' as Ubicacion,
    moneda: 'USD' as 'USD' | 'MXN',
    proveedor: '',
    proveedorId: null as string | null,
    notasGenerales: '',
  }))

  // Partidas detectadas
  const [partidas, setPartidas] = useState<FilaPartidaIa[]>([])

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

  const aplicarDatosExtraidos = useCallback(
    (multi: ExtraccionCotizacionMulti, fallbackLink?: string) => {
      // 1. Aplicar metadatos generales
      setGeneralData((prev) => {
        const prov = multi.proveedor || prev.proveedor
        const match = catalogoProveedores.find(
          (p) => p.nombre.toLowerCase() === prov.trim().toLowerCase()
        )
        return {
          ...prev,
          proveedor: prov,
          proveedorId: match?.id ?? prev.proveedorId,
          moneda: multi.moneda,
          ubicacion: multi.ubicacion,
          fecha: multi.fechaCotizacion || prev.fecha,
          solicitante: multi.solicitante || prev.solicitante,
          notasGenerales: multi.notasGenerales || prev.notasGenerales,
        }
      })

      // 2. Aplicar partidas
      const nuevasPartidas: FilaPartidaIa[] = multi.items.map((item, idx) => ({
        idTemp: `ia-item-${Date.now()}-${idx}`,
        seleccionada: true,
        numeroParte: item.numeroParte || '',
        descripcion: item.descripcion || '',
        marca: item.marca || null,
        cantidad: item.cantidad ?? 1,
        precioUnitario: item.precioUnitario ?? null,
        total:
          item.total ??
          (item.precioUnitario !== null && item.cantidad !== null
            ? item.precioUnitario * item.cantidad
            : null),
        diasHabiles: item.diasHabiles || '',
        link: item.link || fallbackLink || '',
        notas: item.notas
          ? item.marca
            ? `Marca: ${item.marca} | ${item.notas}`
            : item.notas
          : item.marca
          ? `Marca: ${item.marca}`
          : '',
      }))

      setPartidas(nuevasPartidas)
      setExtraidoExitoso(true)
    },
    [catalogoProveedores]
  )

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
        toast.error('El archivo no puede exceder los 10 MB.')
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

        const resultadoMulti: ExtraccionCotizacionMulti = data.multi || {
          proveedor: data.datos?.proveedor || '',
          moneda: data.datos?.moneda || 'USD',
          ubicacion: data.datos?.ubicacion || 'USA',
          fechaCotizacion: null,
          solicitante: null,
          notasGenerales: null,
          items: data.datos ? [data.datos] : [],
        }

        aplicarDatosExtraidos(resultadoMulti, urlReferencia || linkInput)
        const count = resultadoMulti.items.length
        toast.success(
          count > 1
            ? `¡${count} partidas extraídas exitosamente con IA!`
            : '¡Información del producto extraída exitosamente!'
        )
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

  const handleProveedorChange = (nombre: string) => {
    const match = catalogoProveedores.find(
      (p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase()
    )
    setGeneralData((prev) => ({
      ...prev,
      proveedor: nombre,
      proveedorId: match?.id ?? null,
      ubicacion: match?.ubicacion ? (match.ubicacion as Ubicacion) : prev.ubicacion,
    }))
  }

  // Manipulación de partidas
  const handleToggleSeleccionarTodas = (checked: boolean) => {
    setPartidas((prev) => prev.map((p) => ({ ...p, seleccionada: checked })))
  }

  const handleToggleItem = (idTemp: string) => {
    setPartidas((prev) =>
      prev.map((p) => (p.idTemp === idTemp ? { ...p, seleccionada: !p.seleccionada } : p))
    )
  }

  const handleUpdateItem = (idTemp: string, fields: Partial<FilaPartidaIa>) => {
    setPartidas((prev) =>
      prev.map((p) => {
        if (p.idTemp !== idTemp) return p
        const updated = { ...p, ...fields }
        // Auto recalcular total si cambia precio o cantidad
        if ('cantidad' in fields || 'precioUnitario' in fields) {
          const cant = typeof updated.cantidad === 'number' ? updated.cantidad : 1
          const pUnit = updated.precioUnitario
          updated.total = pUnit !== null ? Number((pUnit * cant).toFixed(2)) : null
        }
        return updated
      })
    )
  }

  const handleEliminarItem = (idTemp: string) => {
    setPartidas((prev) => prev.filter((p) => p.idTemp !== idTemp))
  }

  const handleAgregarPartidaManual = () => {
    const nueva: FilaPartidaIa = {
      idTemp: `manual-${Date.now()}`,
      seleccionada: true,
      numeroParte: '',
      descripcion: '',
      marca: null,
      cantidad: 1,
      precioUnitario: null,
      total: null,
      diasHabiles: '',
      link: linkInput.trim() || '',
      notas: '',
    }
    setPartidas((prev) => [...prev, nueva])
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

  const partidasSeleccionadas = useMemo(
    () => partidas.filter((p) => p.seleccionada),
    [partidas]
  )

  const totalEstimadoLote = useMemo(() => {
    return partidasSeleccionadas.reduce((sum, p) => sum + (p.total ?? 0), 0)
  }, [partidasSeleccionadas])

  const handleGuardarLote = async () => {
    if (!generalData.proveedor.trim()) {
      setError('El proveedor es requerido.')
      return
    }

    if (partidasSeleccionadas.length === 0) {
      setError('Selecciona al menos una partida para guardar.')
      return
    }

    // Validar que todas tengan descripción
    const invalidas = partidasSeleccionadas.filter((p) => !p.descripcion.trim())
    if (invalidas.length > 0) {
      setError('Todas las partidas seleccionadas deben tener una descripción.')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const existentes = await clavesExistentes()

      const payloads: NuevaCotizacionPayload[] = partidasSeleccionadas.map((p) => {
        return {
          solicitante: generalData.solicitante.trim() || 'General',
          fecha: generalData.fecha || fechaHoyLocal(),
          estatus: generalData.estatus,
          ubicacion: generalData.ubicacion,
          moneda: generalData.moneda,
          proveedor: generalData.proveedor.trim(),
          proveedorId: generalData.proveedorId,
          numeroParte: p.numeroParte?.trim() || null,
          descripcion: p.descripcion.trim(),
          cantidad: p.cantidad ?? 1,
          precioUnitario: p.precioUnitario ?? null,
          total: p.total ?? null,
          diasHabiles: p.diasHabiles?.trim() || null,
          link: p.link?.trim() || null,
          notas: p.notas?.trim() || generalData.notasGenerales.trim() || null,
        }
      })

      // Verificar duplicados. Antes solo se bloqueaba el caso de una sola partida
      // (`payloads.length === 1`), así que re-procesar un screenshot multi-partida
      // creaba N cotizaciones duplicadas sin ningún aviso. Ahora se descartan las
      // repetidas y se guardan únicamente las nuevas.
      const duplicados = payloads.filter((pay) => existentes.has(claveDedupCotizacion(pay)))
      const nuevos = payloads.filter((pay) => !existentes.has(claveDedupCotizacion(pay)))

      if (nuevos.length === 0) {
        setError(
          payloads.length === 1
            ? 'Ya existe una cotización idéntica con el mismo proveedor, descripción y fecha.'
            : `Las ${payloads.length} partidas ya existen con el mismo proveedor, descripción y fecha.`
        )
        setGuardando(false)
        return
      }

      await crearCotizacionesLote(nuevos)
      toast.success(
        nuevos.length === 1
          ? 'Cotización guardada exitosamente'
          : `¡${nuevos.length} cotizaciones guardadas exitosamente!`,
        duplicados.length > 0
          ? { description: `Se omitieron ${duplicados.length} por estar duplicadas.` }
          : undefined
      )

      // Emitir evento con el primer item creado para refrescar vistas
      const cotizacionRetorno: Cotizacion = {
        ...nuevos[0],
        id: `gen-${Date.now()}`,
        llavePieza: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      }
      onSaved(cotizacionRetorno)

      if (onSavedLote) {
        onSavedLote(
          payloads.map((p, idx) => ({
            ...p,
            id: `gen-${Date.now()}-${idx}`,
            llavePieza: null,
            creadoEn: new Date(),
            actualizadoEn: new Date(),
          }))
        )
      }

      onClose()
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar las cotizaciones. Revisa los datos e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[94vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Extraer Cotización con IA (Multi-Partida)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pega un screenshot con <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">Ctrl + V</kbd> o arrastra un PDF o imagen de catálogo/tienda.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
              <Sparkles className="h-3 w-3" />
              Gemini Vision 3.7
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Panel Izquierdo: Dropzone, Enlace y Datos del Proveedor */}
          <div className="flex flex-col gap-4 border-b border-border p-5 lg:col-span-4 lg:border-b-0 lg:border-r bg-muted/10">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Screenshot / Documento PDF
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
                className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : procesando
                    ? 'border-primary/40 bg-muted/40'
                    : 'border-border hover:border-primary/60 hover:bg-muted/40 bg-background'
                }`}
              >
                {procesando ? (
                  <div className="flex flex-col items-center gap-2 p-3 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      Analizando cotización con Gemini...
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Detectando múltiples partidas, SKUs, precios y entregas
                    </p>
                  </div>
                ) : imagePreview ? (
                  <div className="group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Screenshot de cotización"
                      className="max-h-[140px] w-auto rounded object-contain shadow-sm transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 rounded-lg">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Cambiar o pegar otra captura
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UploadCloud className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Haz clic o arrastra un screenshot o PDF
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        O presiona <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] font-bold">Ctrl + V</kbd>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input para URL de referencia complementaria */}
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-xs font-semibold text-foreground">
                <LinkIcon className="h-3 w-3 text-muted-foreground" />
                Enlace / Tienda web (opcional)
              </label>
              <input
                type="url"
                placeholder="https://mcmaster.com/... o https://misumi.com/..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
            </div>

            {/* Configuración de Proveedor y Mercado */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Proveedor / Tienda *
                </label>
                <input
                  required
                  list="catalogo-proveedores-ia-multi"
                  value={generalData.proveedor}
                  onChange={(e) => handleProveedorChange(e.target.value)}
                  placeholder="Ej. McMaster-Carr, Misumi, Rockwell..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                />
                <datalist id="catalogo-proveedores-ia-multi">
                  {catalogoProveedores.map((p) => (
                    <option key={p.id} value={p.nombre} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Moneda / Mercado
                  </label>
                  <div className="flex rounded-lg border border-input bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setGeneralData((prev) => ({ ...prev, moneda: 'USD', ubicacion: 'USA' }))
                      }
                      className={`flex-1 rounded-md py-1 font-semibold text-[11px] transition-colors ${
                        generalData.moneda === 'USD'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      USD (USA)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setGeneralData((prev) => ({ ...prev, moneda: 'MXN', ubicacion: 'MX' }))
                      }
                      className={`flex-1 rounded-md py-1 font-semibold text-[11px] transition-colors ${
                        generalData.moneda === 'MXN'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      MXN (MX)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Fecha de Cotización
                  </label>
                  <input
                    type="date"
                    value={generalData.fecha}
                    onChange={(e) => setGeneralData({ ...generalData, fecha: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Solicitante
                  </label>
                  <input
                    value={generalData.solicitante}
                    onChange={(e) =>
                      setGeneralData({ ...generalData, solicitante: e.target.value })
                    }
                    placeholder="Edgar, Pablo..."
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Estatus
                  </label>
                  <select
                    value={generalData.estatus}
                    onChange={(e) =>
                      setGeneralData({
                        ...generalData,
                        estatus: e.target.value as EstatusCotizacion,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="cotizado">Cotizado</option>
                    <option value="revisar">Revisar</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>

            {extraidoExitoso && (
              <div className="mt-auto rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{partidas.length} partida(s) listas</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Revisa las partidas en la tabla de la derecha antes de guardar.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Panel Derecho: Tabla de Partidas Detectadas */}
          <div className="flex flex-col p-5 lg:col-span-8 overflow-hidden">
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Partidas Detectadas ({partidasSeleccionadas.length} de {partidas.length}{' '}
                  seleccionadas)
                </h3>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAgregarPartidaManual}
                className="gap-1.5 text-xs h-7"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir fila
              </Button>
            </div>

            {partidas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-semibold">No hay partidas cargadas</p>
                <p className="text-[11px] mt-1 max-w-xs">
                  Pega un screenshot o sube un documento PDF para que Gemini detecte los productos automáticamente.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAgregarPartidaManual}
                  className="mt-4 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar manualmente
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-border">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="w-8 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={
                            partidas.length > 0 && partidas.every((p) => p.seleccionada)
                          }
                          onChange={(e) => handleToggleSeleccionarTodas(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring"
                          aria-label="Seleccionar todas las partidas"
                        />
                      </TableHead>
                      <TableHead className="w-28 px-2 font-semibold">No. Parte / SKU</TableHead>
                      <TableHead className="min-w-[200px] px-2 font-semibold">
                        Descripción del Producto *
                      </TableHead>
                      <TableHead className="w-16 px-2 text-right font-semibold">Cant.</TableHead>
                      <TableHead className="w-24 px-2 text-right font-semibold">
                        P. Unit ({generalData.moneda})
                      </TableHead>
                      <TableHead className="w-24 px-2 text-right font-semibold">
                        Total ({generalData.moneda})
                      </TableHead>
                      <TableHead className="w-28 px-2 font-semibold">Entrega</TableHead>
                      <TableHead className="w-8 px-2 text-center" />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {partidas.map((item) => (
                      <TableRow
                        key={item.idTemp}
                        className={`transition-colors ${
                          !item.seleccionada ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/40'
                        }`}
                      >
                        <TableCell className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={item.seleccionada}
                            onChange={() => handleToggleItem(item.idTemp)}
                            className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            value={item.numeroParte || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, { numeroParte: e.target.value })
                            }
                            placeholder="SKU / No. Parte"
                            className="h-7 text-xs font-mono px-2"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            required
                            value={item.descripcion}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, { descripcion: e.target.value })
                            }
                            placeholder="Descripción clara..."
                            className="h-7 text-xs px-2"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            type="number"
                            step="any"
                            value={item.cantidad ?? ''}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, {
                                cantidad: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            className="h-7 text-xs px-2 text-right font-mono"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            type="number"
                            step="any"
                            value={item.precioUnitario ?? ''}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, {
                                precioUnitario: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="0.00"
                            className="h-7 text-xs px-2 text-right font-mono"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            type="number"
                            step="any"
                            value={item.total ?? ''}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, {
                                total: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="0.00"
                            className="h-7 text-xs px-2 text-right font-mono font-semibold"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          <Input
                            value={item.diasHabiles || ''}
                            onChange={(e) =>
                              handleUpdateItem(item.idTemp, { diasHabiles: e.target.value })
                            }
                            placeholder="2-3 días"
                            className="h-7 text-xs px-2"
                          />
                        </TableCell>
                        <TableCell className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleEliminarItem(item.idTemp)}
                            className="text-muted-foreground hover:text-red-600 p-1 rounded transition-colors"
                            title="Eliminar partida"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">
              Partidas a guardar:{' '}
              <strong className="text-foreground">{partidasSeleccionadas.length}</strong>
            </span>
            {totalEstimadoLote > 0 && (
              <span className="text-muted-foreground">
                Importe estimado:{' '}
                <strong className="text-foreground font-mono font-bold">
                  {formatPrecio(totalEstimadoLote, generalData.moneda)}
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} type="button">
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGuardarLote}
              disabled={guardando || procesando || partidasSeleccionadas.length === 0}
              className="gap-1.5"
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-300" />
              )}
              {guardando
                ? 'Guardando...'
                : partidasSeleccionadas.length > 1
                ? `Guardar ${partidasSeleccionadas.length} Cotizaciones`
                : 'Guardar Cotización'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
