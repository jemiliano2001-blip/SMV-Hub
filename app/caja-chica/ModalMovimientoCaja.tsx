import { useState, useEffect, useRef } from 'react'
import { Upload, Camera, FileText, Trash2, Eye } from 'lucide-react'
import type { NuevoMovimientoCajaPayload } from '@/lib/caja-chica'
import type { MovimientoCajaChica, TipoMovimientoCaja, ComprobanteCaja } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
import { subirComprobanteCajaChica } from '@/lib/storage'
import { ModalCamara } from '@/components/ModalCamara'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  movimiento: MovimientoCajaChica | null
  agregarMovimiento: (payload: NuevoMovimientoCajaPayload) => Promise<void>
  actualizarMovimiento: (
    id: string,
    cambios: Partial<Omit<MovimientoCajaChica, 'id' | 'creadoEn'>>
  ) => Promise<void>
  onClose: () => void
  initialValores?: Partial<MovimientoCajaChica>
}

function mensajeErrorSubida(err: unknown): string {
  const codigo =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''

  switch (codigo) {
    case 'storage/unauthorized':
      return 'No tienes permiso para subir comprobantes. Avisa al administrador.'
    case 'storage/unauthenticated':
      return 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.'
    case 'storage/quota-exceeded':
      return 'Se agotó el espacio de almacenamiento. Avisa al administrador.'
    case 'storage/retry-limit-exceeded':
      return 'La subida tardó demasiado. Revisa tu conexión e intenta de nuevo.'
    case 'storage/canceled':
      return 'Se canceló la subida del comprobante.'
    default:
      return `No se pudo subir el comprobante${codigo ? ` (${codigo})` : ''}. El movimiento no se guardó; intenta de nuevo.`
  }
}

const CATEGORIAS = [
  "Agua", "Telefonía", "Fletes", "Peaje/Puente", "Mantenimiento", 
  "Refacciones", "Herramienta", "Consumibles/Comida", "Posada/Evento", 
  "Limpieza/Basura", "Papelería", "Salud", "Yonque", "Reposición", "Devolución", "Otros"
]

export default function ModalMovimientoCaja({
  movimiento,
  agregarMovimiento,
  actualizarMovimiento,
  onClose,
  initialValores
}: ModalProps) {
  const isEditing = !!movimiento
  const [loading, setLoading] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoMovimientoCaja>(movimiento?.tipo || initialValores?.tipo || 'SALIDA')
  const [subtipoEntrada, setSubtipoEntrada] = useState<'REABASTECIMIENTO' | 'DEVOLUCION'>('REABASTECIMIENTO')
  
  const [fecha, setFecha] = useState(movimiento?.fecha || initialValores?.fecha || fechaHoyLocal())
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion || initialValores?.descripcion || '')
  const [proveedor, setProveedor] = useState(movimiento?.proveedor || initialValores?.proveedor || '')
  const [categoria, setCategoria] = useState(movimiento?.categoria || initialValores?.categoria || '')
  const [solicitante, setSolicitante] = useState(movimiento?.solicitante || initialValores?.solicitante || '')
  const [monto, setMonto] = useState(movimiento?.monto.toString() || initialValores?.monto?.toString() || '')
  const [comprobante, setComprobante] = useState<ComprobanteCaja>(movimiento?.comprobante || initialValores?.comprobante || 'NINGUNO')
  const [deducible, setDeducible] = useState(movimiento?.deducible || initialValores?.deducible || false)

  // Estados para archivos adjuntos
  const [archivo, setArchivo] = useState<File | null>(null)
  const [archivoPreview, setArchivoPreview] = useState<string | null>(movimiento?.archivoUrl || null)
  const [archivoUrl, setArchivoUrl] = useState<string | null>(movimiento?.archivoUrl || null)
  const [archivoNombre, setArchivoNombre] = useState<string | null>(movimiento?.archivoNombre || null)
  const [archivoPath, setArchivoPath] = useState<string | null>(movimiento?.archivoPath || null)
  const [isCamaraModalOpen, setIsCamaraModalOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (archivoPreview && archivoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(archivoPreview)
      }
    }
  }, [archivoPreview])

  // Aplicar defaults de ENTRADA cuando cambia el subtipo o el tipo. Ajuste
  // durante el render (no en un efecto) para que no haya un commit intermedio
  // con los campos del subtipo anterior todavía visibles.
  const autoKeyEntrada = `${tipo}:${subtipoEntrada}`
  const [autoKeyEntradaPrevia, setAutoKeyEntradaPrevia] = useState(autoKeyEntrada)
  if (autoKeyEntrada !== autoKeyEntradaPrevia) {
    setAutoKeyEntradaPrevia(autoKeyEntrada)
    if (tipo === 'ENTRADA' && !isEditing) {
      if (subtipoEntrada === 'REABASTECIMIENTO') {
        setProveedor('Finanzas')
        setCategoria('Recarga de Caja')
        setDescripcion('Reabastecimiento de Fondo Fijo')
        setSolicitante('Administración')
        setComprobante('NINGUNO')
        setDeducible(false)
      } else {
        setProveedor('Interno')
        setCategoria('Devolución')
        setDescripcion('Devolución de cambio por compra')
        setSolicitante('')
        setComprobante('NINGUNO')
        setDeducible(false)
      }
    }
  }

  const procesarArchivo = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no puede exceder los 10 MB")
      return
    }

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Selecciona una imagen o un archivo PDF.')
      return
    }

    if (archivoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(archivoPreview)
    }

    setArchivo(file)
    setArchivoNombre(file.name)
    // Si sube comprobante pero sigue siendo VALE o NINGUNO, lo pasamos a TICKET
    if (comprobante === 'NINGUNO' || comprobante === 'VALE') setComprobante('TICKET')

    setArchivoUrl(null)
    setArchivoPath(null)
    setError(null)

    if (file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file)
      setArchivoPreview(preview)
    } else {
      setArchivoPreview(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    procesarArchivo(file)
    e.target.value = ''
  }

  const handleRemoveArchivo = () => {
    if (archivoPreview && archivoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(archivoPreview)
    }
    setArchivo(null)
    setArchivoNombre(null)
    setArchivoPreview(null)
    setArchivoUrl(null)
    setArchivoPath(null)
  }

  const handleTipoChange = (nuevoTipo: TipoMovimientoCaja) => {
    setTipo(nuevoTipo)
    if (nuevoTipo === 'SALIDA') {
      if (!isEditing) {
        setProveedor('')
        setCategoria('')
        setDescripcion('')
        setSolicitante('')
        setComprobante('NINGUNO')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const montoNum = parseFloat(monto)
    if (isNaN(montoNum) || montoNum < 0) {
      setError("El monto debe ser un número válido mayor a 0.")
      setLoading(false)
      return
    }

    try {
      let finalUrl = archivoUrl
      let finalPath = archivoPath
      let finalNombre = archivoNombre

      if (archivo) {
        setSubiendo(true)
        try {
          const uploadRes = await subirComprobanteCajaChica(archivo)
          finalUrl = uploadRes.url
          finalPath = uploadRes.path
          finalNombre = archivo.name
        } catch (uploadErr) {
          console.error('Error al subir el comprobante de caja chica:', uploadErr)
          setError(mensajeErrorSubida(uploadErr))
          return
        } finally {
          setSubiendo(false)
        }
      }

      const payload = {
        fecha,
        periodo: fecha.substring(0, 7), // YYYY-MM
        descripcion,
        proveedor,
        categoria,
        solicitante,
        monto: montoNum,
        comprobante,
        deducible,
        tipo,
        costoReal: montoNum, 
        ivaEstimado: deducible ? parseFloat((montoNum * 0.16).toFixed(2)) : 0, 
        verificado: movimiento?.verificado || false,
        archivoUrl: finalUrl,
        archivoNombre: finalNombre,
        archivoPath: finalPath
      }

      if (isEditing) {
        await actualizarMovimiento(movimiento.id, payload)
      } else {
        await agregarMovimiento(payload)
      }
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setError("Ocurrió un error al guardar el movimiento.")
    } finally {
      setLoading(false)
    }
  }


  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border p-6">
          <DialogTitle className="flex items-center gap-2 text-left">
            {isEditing ? 'Editar movimiento' : 'Nuevo movimiento'}
            {comprobante === 'VALE' && tipo === 'SALIDA' ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Vale pendiente
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {error && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-200">
              {error}
            </div>
          )}

          {/* Tipo de Movimiento Toggle */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex bg-muted p-1 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => handleTipoChange('SALIDA')}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                  tipo === 'SALIDA'
                    ? 'bg-card text-rose-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Gasto (Salida)
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange('ENTRADA')}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                  tipo === 'ENTRADA'
                    ? 'bg-card text-emerald-600 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Recarga (Entrada)
              </button>
            </div>
          </div>

          {/* Selector Inteligente de Entrada */}
          {tipo === 'ENTRADA' && !isEditing && (
            <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
              <label className="block text-sm font-medium text-emerald-900 mb-3">¿De dónde viene el dinero?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubtipoEntrada('REABASTECIMIENTO')}
                  className={`text-left p-3 rounded-lg border text-sm transition-all ${
                    subtipoEntrada === 'REABASTECIMIENTO' ? 'bg-emerald-100 border-emerald-500 shadow-sm' : 'bg-card border-border hover:bg-emerald-50'
                  }`}
                >
                  <p className="font-semibold text-emerald-900">Reabastecimiento</p>
                  <p className="text-emerald-700/70 text-xs mt-1">Finanzas te dio dinero para volver a llenar tu caja chica.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSubtipoEntrada('DEVOLUCION')}
                  className={`text-left p-3 rounded-lg border text-sm transition-all ${
                    subtipoEntrada === 'DEVOLUCION' ? 'bg-emerald-100 border-emerald-500 shadow-sm' : 'bg-card border-border hover:bg-emerald-50'
                  }`}
                >
                  <p className="font-semibold text-emerald-900">Devolución de Cambio</p>
                  <p className="text-emerald-700/70 text-xs mt-1">Alguien te regresó dinero que sobró de una compra.</p>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Monto</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Descripción</label>
              <input
                type="text"
                required
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                placeholder="Ej. Recarga Telcel"
              />
            </div>

            {/* Ocultamos Proveedor y Categoría si es Reabastecimiento */}
            {!(tipo === 'ENTRADA' && subtipoEntrada === 'REABASTECIMIENTO') && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground">Proveedor / Lugar</label>
                  <input
                    type="text"
                    required
                    value={proveedor}
                    onChange={e => setProveedor(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                    placeholder="Ej. Oxxo"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground">Categoría</label>
                  <input
                    type="text"
                    list="categorias-caja"
                    required
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                    placeholder="Selecciona o escribe..."
                  />
                  <datalist id="categorias-caja">
                    {CATEGORIAS.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </>
            )}

            {/* Ocultamos solicitante solo en reabastecimiento */}
            {!(tipo === 'ENTRADA' && subtipoEntrada === 'REABASTECIMIENTO') && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">
                  {tipo === 'ENTRADA' ? '¿Quién devuelve?' : 'Solicitante'}
                </label>
                <input
                  type="text"
                  required
                  value={solicitante}
                  onChange={e => setSolicitante(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                  placeholder={tipo === 'ENTRADA' ? 'Nombre de quien devuelve...' : '¿Quién pidió el dinero?'}
                />
              </div>
            )}

            {tipo === 'SALIDA' && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-foreground">Tipo de Comprobante</label>
                  <select
                    value={comprobante}
                    onChange={e => setComprobante(e.target.value as ComprobanteCaja)}
                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:ring-ring focus:border-primary"
                  >
                    <option value="NINGUNO">Ninguno</option>
                    <option value="TICKET">Ticket</option>
                    <option value="FACTURA">Factura</option>
                    <option value="VALE">Vale Provisional (Préstamo)</option>
                  </select>
                </div>

                <div className="space-y-1 flex items-center h-full pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deducible}
                      onChange={e => setDeducible(e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-ring border-input rounded"
                    />
                    <span className="text-sm font-medium text-foreground">Es Deducible</span>
                  </label>
                </div>

                {comprobante === 'VALE' && !archivoPreview && !archivoUrl ? (
                  <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-full mt-0.5">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-amber-800 font-semibold text-sm">Préstamo Temporal (Vale)</h4>
                      <p className="text-amber-700/80 text-xs mt-1">Este movimiento registrará la salida del dinero sin foto de ticket. Cuando la persona regrese con el ticket y el cambio, edita este movimiento, actualiza el monto real gastado y adjunta el ticket.</p>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-medium text-foreground">Archivo de Comprobante</label>
                      {(archivoPreview || archivoUrl) ? (
                        <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted">
                          <div className="flex items-center gap-3 min-w-0">
                            {archivoPreview && !archivoNombre?.toLowerCase().endsWith('.pdf') && !archivoUrl?.toLowerCase().includes('.pdf') ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={archivoPreview}
                                alt="Vista previa"
                                className="h-12 w-12 rounded object-cover border border-border bg-card"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-sky-50 border border-sky-100 flex items-center justify-center text-primary">
                                <FileText className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-xs" title={archivoNombre || 'Comprobante digital'}>
                                {archivoNombre || 'Comprobante digital'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {archivo ? 'Nuevo archivo seleccionado' : 'Archivo guardado en el servidor'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(archivoUrl || archivoPreview) && (
                              <a
                                href={archivoPreview || archivoUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
                                title="Visualizar comprobante"
                              >
                                <Eye className="h-4.5 w-4.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={handleRemoveArchivo}
                              className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Eliminar comprobante"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-input hover:border-primary hover:bg-sky-50/20 rounded-lg cursor-pointer transition-all group text-center"
                          >
                            <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold text-foreground">Subir PDF o Imagen</span>
                            <span className="text-[10px] text-muted-foreground">Seleccionar desde tu equipo</span>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </div>

                          <div
                            onClick={() => setIsCamaraModalOpen(true)}
                            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-input hover:border-primary hover:bg-sky-50/20 rounded-lg cursor-pointer transition-all group text-center"
                          >
                            <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold text-foreground">Tomar Foto (Cámara)</span>
                            <span className="text-[10px] text-muted-foreground">Usar la cámara del dispositivo o celular</span>
                          </div>
                        </div>
                      )}
                    {subiendo && (
                      <p className="text-xs text-primary">Subiendo comprobante…</p>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          <DialogFooter className="border-t border-border pt-6 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={tipo === 'ENTRADA' ? 'bg-emerald-600 hover:bg-emerald-700' : undefined}
            >
              {subiendo
                ? 'Subiendo comprobante…'
                : loading
                  ? 'Guardando…'
                  : isEditing
                    ? 'Guardar cambios'
                    : tipo === 'ENTRADA'
                      ? 'Guardar entrada'
                      : 'Registrar gasto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <ModalCamara
        isOpen={isCamaraModalOpen}
        onClose={() => setIsCamaraModalOpen(false)}
        onCapture={procesarArchivo}
        titulo="Comprobante - Foto de Cámara"
      />
    </>
  )
}
