'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Requisicion, PrioridadRequisicion } from '@/lib/schemas'
import { actualizarRequisicion } from '@/lib/requisiciones'
import { SOLICITANTES, EMPRESAS, PRIORIDADES } from './RequisicionesList'
import { ESTADOS_REQUISICION, ESTADO_LABEL, REVISION_FINANZAS_OPCIONES } from '@/lib/requisiciones-helpers'

interface Props {
  requisicionBase: Requisicion
  onClose: () => void
  onSaved: (requisicion: Requisicion) => void
}

const SELECT_CLS =
  'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring'

export default function RequisicionFormModal({ requisicionBase, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuto = requisicionBase.tipo === 'automatizacion'

  const [formData, setFormData] = useState({
    descripcion: requisicionBase.descripcion,
    link: requisicionBase.link || '',
    solicitante: requisicionBase.solicitante,
    cantidad: requisicionBase.cantidad || '',
    tienda: requisicionBase.tienda || '',
    prioridad: (requisicionBase.prioridad || '') as PrioridadRequisicion | '',
    empresa: requisicionBase.empresa || '',
    ordenServicio: requisicionBase.ordenServicio || '',
    fechaPedido: requisicionBase.fechaPedido,
    parteNumero: requisicionBase.parteNumero || '',
    fechaEntregaEst: requisicionBase.fechaEntregaEst || '',
    recibio: requisicionBase.recibio || '',
    revisionFinanzas: requisicionBase.revisionFinanzas || '',
    nota: requisicionBase.nota || '',
    estado: requisicionBase.estado,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.descripcion.trim()) return
    setLoading(true)
    setError(null)

    try {
      const cambios = {
        descripcion: formData.descripcion.trim(),
        link: formData.link.trim() || null,
        solicitante: formData.solicitante,
        cantidad: formData.cantidad.trim() || null,
        tienda: formData.tienda.trim() || null,
        prioridad: (formData.prioridad || null) as PrioridadRequisicion | null,
        empresa: formData.empresa || null,
        ordenServicio: formData.ordenServicio.trim() || null,
        fechaPedido: formData.fechaPedido,
        parteNumero: isAuto ? (formData.parteNumero.trim() || null) : null,
        fechaEntregaEst: isAuto ? (formData.fechaEntregaEst || null) : null,
        recibio: formData.recibio.trim() || null,
        revisionFinanzas: formData.revisionFinanzas.trim() || null,
        nota: formData.nota.trim() || null,
        estado: formData.estado,
      }

      await actualizarRequisicion(requisicionBase.id, cambios)
      onSaved({ ...requisicionBase, ...cambios, actualizadoEn: new Date() } as Requisicion)
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar la requisición. Revisa los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Editar requisición</DialogTitle>
          <DialogDescription>{isAuto ? 'Automatización' : 'Compra general'}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form id="requisicion-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Descripción del artículo *"
                value={formData.descripcion}
                onChange={(e) => setFormData((f) => ({ ...f, descripcion: e.target.value }))}
                required
                className="flex-1"
              />
              <select
                value={formData.solicitante}
                onChange={(e) => setFormData((f) => ({ ...f, solicitante: e.target.value }))}
                className={SELECT_CLS}
              >
                <option value="">Solicitante</option>
                {SOLICITANTES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input
              type="url"
              placeholder="Link del producto (opcional)"
              value={formData.link}
              onChange={(e) => setFormData((f) => ({ ...f, link: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input
                type="text"
                placeholder="Cantidad"
                value={formData.cantidad}
                onChange={(e) => setFormData((f) => ({ ...f, cantidad: e.target.value }))}
              />
              <Input
                type="text"
                placeholder={isAuto ? 'Proveedor' : 'Tienda / Proveedor'}
                value={formData.tienda}
                onChange={(e) => setFormData((f) => ({ ...f, tienda: e.target.value }))}
              />
              {!isAuto ? (
                <select
                  value={formData.prioridad}
                  onChange={(e) => setFormData((f) => ({ ...f, prioridad: e.target.value as PrioridadRequisicion | '' }))}
                  className={SELECT_CLS}
                >
                  <option value="">Prioridad</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type="text"
                  placeholder="No. de parte"
                  value={formData.parteNumero}
                  onChange={(e) => setFormData((f) => ({ ...f, parteNumero: e.target.value }))}
                />
              )}
              <select
                value={formData.empresa}
                onChange={(e) => setFormData((f) => ({ ...f, empresa: e.target.value }))}
                className={SELECT_CLS}
              >
                <option value="">Empresa</option>
                {EMPRESAS.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="text"
                placeholder="S.O. / Orden de trabajo"
                value={formData.ordenServicio}
                onChange={(e) => setFormData((f) => ({ ...f, ordenServicio: e.target.value }))}
                className="w-48"
              />
              <Input
                type="date"
                title={isAuto ? 'Fecha de compra' : 'Fecha de pedido'}
                value={formData.fechaPedido}
                onChange={(e) => setFormData((f) => ({ ...f, fechaPedido: e.target.value }))}
              />
              {isAuto ? (
                <Input
                  type="date"
                  title="Fecha de entrega estimada"
                  value={formData.fechaEntregaEst}
                  onChange={(e) => setFormData((f) => ({ ...f, fechaEntregaEst: e.target.value }))}
                />
              ) : null}
              <select
                value={formData.estado}
                onChange={(e) => setFormData((f) => ({ ...f, estado: e.target.value as Requisicion['estado'] }))}
                className={SELECT_CLS}
              >
                {ESTADOS_REQUISICION.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                ))}
              </select>
            </div>
            {isAuto ? (
              <div className="flex flex-wrap gap-3">
                <select
                  value={formData.recibio}
                  onChange={(e) => setFormData((f) => ({ ...f, recibio: e.target.value }))}
                  className={SELECT_CLS}
                >
                  <option value="">Recibió</option>
                  {SOLICITANTES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={formData.revisionFinanzas}
                  onChange={(e) => setFormData((f) => ({ ...f, revisionFinanzas: e.target.value }))}
                  className={SELECT_CLS}
                >
                  {REVISION_FINANZAS_OPCIONES.map((op) => (
                    <option key={op || 'vacio'} value={op}>{op || 'Rev. finanzas'}</option>
                  ))}
                </select>
                <Input
                  type="text"
                  placeholder="Nota (entregas parciales, seguimiento…)"
                  value={formData.nota}
                  onChange={(e) => setFormData((f) => ({ ...f, nota: e.target.value }))}
                  className="min-w-[200px] flex-1"
                />
              </div>
            ) : null}
          </form>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" form="requisicion-form" disabled={loading || !formData.descripcion.trim()}>
            {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
