import { useState, useEffect, useRef } from 'react'
import { X, Upload, Camera, FileText, Trash2, Eye } from 'lucide-react'
import type { NuevoMovimientoCajaPayload } from '@/lib/caja-chica'
import type { MovimientoCajaChica, TipoMovimientoCaja, ComprobanteCaja } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
import { subirComprobanteCajaChica } from '@/lib/storage'

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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {isEditing ? 'Editar Movimiento' : 'Nuevo Movimiento'}
              {comprobante === 'VALE' && tipo === 'SALIDA' && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Vale Pendiente</span>
              )}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* Tipo de Movimiento Toggle */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => handleTipoChange('SALIDA')}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                  tipo === 'SALIDA'
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Gasto (Salida)
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange('ENTRADA')}
                className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                  tipo === 'ENTRADA'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
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
                    subtipoEntrada === 'REABASTECIMIENTO' ? 'bg-emerald-100 border-emerald-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-emerald-50'
                  }`}
                >
                  <p className="font-semibold text-emerald-900">Reabastecimiento</p>
                  <p className="text-emerald-700/70 text-xs mt-1">Finanzas te dio dinero para volver a llenar tu caja chica.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSubtipoEntrada('DEVOLUCION')}
                  className={`text-left p-3 rounded-lg border text-sm transition-all ${
                    subtipoEntrada === 'DEVOLUCION' ? 'bg-emerald-100 border-emerald-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-emerald-50'
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
              <label className="block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Monto</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <input
                type="text"
                required
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                placeholder="Ej. Recarga Telcel"
              />
            </div>

            {/* Ocultamos Proveedor y Categoría si es Reabastecimiento */}
            {!(tipo === 'ENTRADA' && subtipoEntrada === 'REABASTECIMIENTO') && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Proveedor / Lugar</label>
                  <input
                    type="text"
                    required
                    value={proveedor}
                    onChange={e => setProveedor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                    placeholder="Ej. Oxxo"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Categoría</label>
                  <input
                    type="text"
                    list="categorias-caja"
                    required
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
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
                <label className="block text-sm font-medium text-gray-700">
                  {tipo === 'ENTRADA' ? '¿Quién devuelve?' : 'Solicitante'}
                </label>
                <input
                  type="text"
                  required
                  value={solicitante}
                  onChange={e => setSolicitante(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                  placeholder={tipo === 'ENTRADA' ? 'Nombre de quien devuelve...' : '¿Quién pidió el dinero?'}
                />
              </div>
            )}

            {tipo === 'SALIDA' && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Tipo de Comprobante</label>
                  <select
                    value={comprobante}
                    onChange={e => setComprobante(e.target.value as ComprobanteCaja)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
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
                      className="h-4 w-4 text-[#0369A1] focus:ring-[#0369A1] border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Es Deducible</span>
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
                    <label className="block text-sm font-medium text-gray-700">Archivo de Comprobante</label>
                      {(archivoPreview || archivoUrl) ? (
                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-3 min-w-0">
                            {archivoPreview && !archivoNombre?.toLowerCase().endsWith('.pdf') && !archivoUrl?.toLowerCase().includes('.pdf') ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={archivoPreview}
                                alt="Vista previa"
                                className="h-12 w-12 rounded object-cover border border-gray-200 bg-white"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0369A1]">
                                <FileText className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs" title={archivoNombre || 'Comprobante digital'}>
                                {archivoNombre || 'Comprobante digital'}
                              </p>
                              <p className="text-xs text-gray-500">
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
                                className="p-1.5 text-gray-500 hover:text-[#0369A1] hover:bg-gray-100 rounded-md transition-colors"
                                title="Visualizar comprobante"
                              >
                                <Eye className="h-4.5 w-4.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={handleRemoveArchivo}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 hover:border-[#0369A1] hover:bg-sky-50/20 rounded-lg cursor-pointer transition-all group text-center"
                          >
                            <Upload className="h-6 w-6 text-gray-400 group-hover:text-[#0369A1] group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold text-gray-700">Subir PDF o Imagen</span>
                            <span className="text-[10px] text-gray-400">Seleccionar desde tu equipo</span>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </div>

                          <div
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 hover:border-[#0369A1] hover:bg-sky-50/20 rounded-lg cursor-pointer transition-all group text-center sm:hidden"
                          >
                            <Camera className="h-6 w-6 text-gray-400 group-hover:text-[#0369A1] group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold text-gray-700">Tomar Foto (Cámara)</span>
                            <span className="text-[10px] text-gray-400">Usar la cámara del celular</span>
                            <input
                              ref={cameraInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </div>
                        </div>
                      )}
                    {subiendo && (
                      <p className="text-xs text-[#0369A1]">Subiendo comprobante…</p>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0369A1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                tipo === 'ENTRADA' ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' : 'bg-[#0369A1] hover:bg-[#0284C7] focus:ring-[#0369A1]'
              }`}
            >
              {subiendo
                ? 'Subiendo comprobante…'
                : loading
                  ? 'Guardando…'
                  : isEditing
                    ? 'Guardar Cambios'
                    : tipo === 'ENTRADA' ? 'Guardar Entrada' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
