'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ShieldCheck, Sparkles, ShoppingCart } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import ModuleSurface from '@/components/layout/ModuleSurface'
import type { PrioridadFlujo, CategoriaProveedor } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
import type { NuevaRequisicionFlujoPayload } from '@/lib/requisiciones-flujo'
import { useProveedores } from '@/lib/hooks/useProveedores'
import { listarCotizaciones } from '@/lib/cotizaciones'
import {
  aprenderProveedorPreferidoPorPieza,
  listarTodasCotizacionesRequisicion,
  sugerirPrecioYProveedor,
  type PreferenciaPieza,
} from '@/lib/proveedores-inteligencia-cruzada'
import { obtenerTipoCambio, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'

interface Props {
  abierto: boolean
  onClose: () => void
  onCrear: (payload: NuevaRequisicionFlujoPayload) => Promise<unknown>
}

export default function NuevaRequisicionModal({ abierto, onClose, onCrear }: Props) {
  const { todosProveedores } = useProveedores()
  const [solicitante, setSolicitante] = useState('')
  const [departamento, setDepartamento] = useState('Taller Maquinados')
  const [prioridad, setPrioridad] = useState<PrioridadFlujo>('media')
  const [motivo, setMotivo] = useState('')
  const [aprobacionRequerida, setAprobacionRequerida] = useState(true)
  const [aprobador, setAprobador] = useState('Ing. Francisco Pantoja')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [preferencias, setPreferencias] = useState<PreferenciaPieza[]>([])
  const [sugerenciaMsg, setSugerenciaMsg] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!abierto) return
    void Promise.all([
      listarCotizaciones(),
      listarTodasCotizacionesRequisicion(),
      obtenerTipoCambio(),
    ])
      .then(([historico, cotReq, fx]) => {
        const prefs = aprenderProveedorPreferidoPorPieza(
          cotReq,
          historico,
          fx.usdToMxn || TIPO_CAMBIO_DEFAULT_USD_MXN
        )
        setPreferencias(prefs)
      })
      .catch(() => setPreferencias([]))
  }, [abierto])

  const [items, setItems] = useState<
    Array<{
      descripcion: string
      categoria: string
      cantidad: number
      unidad: string
      marcaPreferida: string
      especificacion: string
      fechaRequerida: string
      proveedorSugeridoId: string
      proveedorSugeridoNombre: string
    }>
  >([
    {
      descripcion: '',
      categoria: 'endmills',
      cantidad: 10,
      unidad: 'pza',
      marcaPreferida: '',
      especificacion: '',
      // Fecha default (hoy + 5 días) client-only; StrictMode reejecuta con el mismo día.
      // eslint-disable-next-line react-hooks/purity
      fechaRequerida: fechaHoyLocal(new Date(Date.now() + 5 * 86400000)),
      proveedorSugeridoId: '',
      proveedorSugeridoNombre: '',
    },
  ])

  function aplicarSugerencia(idx: number, descripcion: string) {
    if (!descripcion.trim() || preferencias.length === 0) return
    const sug = sugerirPrecioYProveedor(null, descripcion, preferencias)
    if (!sug) {
      setSugerenciaMsg((prev) => ({ ...prev, [idx]: '' }))
      return
    }
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        // Solo autollenar si el usuario no eligió proveedor aún
        if (it.proveedorSugeridoId) return it
        return {
          ...it,
          proveedorSugeridoId: sug.proveedorId,
          proveedorSugeridoNombre: sug.proveedorNombre,
        }
      })
    )
    setSugerenciaMsg((prev) => ({
      ...prev,
      [idx]: `Sugerido: ${sug.proveedorNombre} · último precio ${sug.monedaUltima} ${sug.precioOriginal.toFixed(2)} (${sug.vecesGanador}×)`,
    }))
  }

  function agregarItem() {
    setItems((prev) => [
      ...prev,
      {
        descripcion: '',
        categoria: 'endmills',
        cantidad: 5,
        unidad: 'pza',
        marcaPreferida: '',
        especificacion: '',
        fechaRequerida: fechaHoyLocal(new Date(Date.now() + 5 * 86400000)),
        proveedorSugeridoId: '',
        proveedorSugeridoNombre: '',
      },
    ])
  }

  function eliminarItem(idx: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, campo: string, valor: unknown) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        if (campo === 'proveedorSugeridoId') {
          const prov = todosProveedores.find((p) => p.id === valor)
          return {
            ...it,
            proveedorSugeridoId: (valor as string) || '',
            proveedorSugeridoNombre: prov?.nombre || '',
          }
        }
        return { ...it, [campo]: valor }
      })
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!solicitante.trim()) {
      setErrorMsg('Por favor especifica el nombre del solicitante.')
      return
    }
    const invalidItem = items.find((i) => !i.descripcion.trim())
    if (invalidItem) {
      setErrorMsg('Todos los ítems deben tener una descripción válida.')
      return
    }

    setGuardando(true)
    setErrorMsg(null)
    try {
      await onCrear({
        solicitante: solicitante.trim(),
        departamento,
        prioridadFlujo: prioridad,
        motivoJustificacion: motivo.trim(),
        aprobacionRequerida,
        aprobador: aprobacionRequerida ? aprobador : undefined,
        items,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setErrorMsg('Ocurrió un error al guardar la requisición.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-sans p-6">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Nueva Requisición de Compras (Tooling &amp; Taller)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Levanta una solicitud formal de herramental para cotización con proveedores registrados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Encabezado */}
          <ModuleSurface className="grid grid-cols-1 gap-4 p-4 text-xs sm:grid-cols-3">
            <div>
              <label className="font-bold text-foreground block mb-1">Solicitante *</label>
              <input
                type="text"
                required
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
                placeholder="Ej. Oscar Pantoja / Salvador"
                className="w-full px-3 py-2 border border-input rounded-lg bg-card font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-foreground block mb-1">Departamento / Área</label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-card font-medium"
              >
                <option value="Taller Maquinados">Taller Maquinados CNC</option>
                <option value="Ingeniería de Procesos">Ingeniería de Procesos</option>
                <option value="Almacén General">Almacén General</option>
                <option value="Automatización">Automatización &amp; Control</option>
                <option value="Administración">Administración</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-foreground block mb-1">Prioridad Operativa</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadFlujo)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-card font-bold text-foreground"
              >
                <option value="urgente">Urgente (1-2 días)</option>
                <option value="alta">Alta (3-5 días)</option>
                <option value="media">Media (1-2 semanas)</option>
                <option value="baja">Baja (Cuando se pueda)</option>
              </select>
            </div>
          </ModuleSurface>

          <div>
            <label className="font-bold text-foreground text-xs block mb-1">Motivo o Justificación de la Compra</label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Desgaste en producción de flechas OT-9940. Requerido para evitar paro de máquina."
              className="w-full px-3 py-2 text-xs border border-input rounded-lg bg-card placeholder:text-muted-foreground"
            />
          </div>

          {/* Ítems Dinámicos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Ítems / Herramientas Solicitadas ({items.length})
              </h3>
              <button
                type="button"
                onClick={agregarItem}
                className="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Herramienta
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <ModuleSurface key={idx} className="space-y-3 p-3.5">
                  <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                    <span className="font-bold font-mono text-muted-foreground">Herramienta #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarItem(idx)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-foreground block mb-1">Descripción del Ítem *</label>
                      <input
                        type="text"
                        required
                        value={it.descripcion}
                        onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                        onBlur={(e) => aplicarSugerencia(idx, e.target.value)}
                        placeholder="Ej. Endmill 1/2' 5 Gavilanes AlTiN Carburo Sólido"
                        className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs"
                      />
                      {sugerenciaMsg[idx] && (
                        <p className="mt-1 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {sugerenciaMsg[idx]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-foreground block mb-1">Categoría</label>
                      <select
                        value={it.categoria}
                        onChange={(e) => updateItem(idx, 'categoria', e.target.value)}
                        className="w-full px-2 py-1.5 border border-input rounded-lg text-xs font-medium"
                      >
                        <option value="endmills">Endmills / Cortadores</option>
                        <option value="insertos">Insertos Carreado/Torneado</option>
                        <option value="tooling">Tooling / Conos CNC</option>
                        <option value="consumibles">Consumibles / Aceites</option>
                        <option value="otros">Otros Materiales</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <label className="font-bold text-foreground block mb-1">Cant.</label>
                        <input
                          type="number"
                          min={1}
                          value={it.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-input rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="w-1/2">
                        <label className="font-bold text-foreground block mb-1">Unidad</label>
                        <input
                          type="text"
                          value={it.unidad}
                          onChange={(e) => updateItem(idx, 'unidad', e.target.value)}
                          placeholder="pza / cja"
                          className="w-full px-2 py-1.5 border border-input rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">Marca Preferida</label>
                      <input
                        type="text"
                        value={it.marcaPreferida}
                        onChange={(e) => updateItem(idx, 'marcaPreferida', e.target.value)}
                        placeholder="Ej. Shars / YG-1 / Kennametal"
                        className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">Proveedor Sugerido (Catálogo)</label>
                      <select
                        value={it.proveedorSugeridoId}
                        onChange={(e) => updateItem(idx, 'proveedorSugeridoId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-input rounded-lg text-xs bg-muted font-medium"
                      >
                        <option value="">-- Sin sugerencia inicial --</option>
                        {todosProveedores
                          .filter((p) => p.categorias.includes(it.categoria as CategoriaProveedor) || p.categorias.includes('otros'))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.tipoProveedor === 'barato' ? '$ Económico' : p.tipoProveedor === 'premium' ? '$$$ Premium' : '$ Estándar'})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-muted-foreground block mb-1">Especificación Taller</label>
                      <input
                        type="text"
                        value={it.especificacion}
                        onChange={(e) => updateItem(idx, 'especificacion', e.target.value)}
                        placeholder="Ej. Recubrimiento AlTiN Z=5 Cuello 2.0'"
                        className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </ModuleSurface>
              ))}
            </div>
          </div>

          {/* Aprobación Simple */}
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-purple-900 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-purple-700" />
                ¿Requiere Aprobación Formal de Gerencia?
              </label>
              <input
                type="checkbox"
                checked={aprobacionRequerida}
                onChange={(e) => setAprobacionRequerida(e.target.checked)}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
            </div>

            {aprobacionRequerida && (
              <div>
                <label className="font-semibold text-purple-800 block mb-1">Nombre del Aprobador Designado</label>
                <input
                  type="text"
                  value={aprobador}
                  onChange={(e) => setAprobador(e.target.value)}
                  className="w-full rounded-lg border border-purple-300 bg-card px-3 py-1.5 text-xs font-medium"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs disabled:opacity-50"
            >
              {guardando ? 'Guardando Requisición...' : 'Enviar Requisición a Proceso'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
