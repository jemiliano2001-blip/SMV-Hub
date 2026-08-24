"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CategoriaEndmill, CrearEndmillMedidaInput } from "@/lib/schemas"

export const CATEGORIAS_OPCIONES: Array<{ id: CategoriaEndmill; label: string }> = [
  { id: "FLAT", label: "Flat" },
  { id: "BALL", label: "Ball" },
  { id: "LARGO_FLAT", label: "Largo Flat" },
  { id: "LARGO_BOLA", label: "Largo Bola" },
  { id: "EXTRA_LARGO_FLAT", label: "Extra Largo Flat" },
  { id: "EXTRA_LARGO_BOLA", label: "Extra Largo Bola" },
  { id: "RUPA_CARBURO", label: "Rupa / Carburo" },
]

interface FormState {
  categoria: CategoriaEndmill
  medidaPulgadas: string
  descripcion: string
  specPropuesta: string
  stockInicial: string
  precioUSD: string
  objetivoPar: string
  requiereConfirmacion: boolean
  notas: string
}

const INITIAL_FORM: FormState = {
  categoria: "FLAT",
  medidaPulgadas: "",
  descripcion: "",
  specPropuesta: "",
  stockInicial: "0",
  precioUSD: "0",
  objetivoPar: "",
  requiereConfirmacion: false,
  notas: "",
}

export default function ModalCrearEndmill({
  abierto,
  onClose,
  onCrearMedida,
}: {
  abierto: boolean
  onClose: () => void
  onCrearMedida: (input: CrearEndmillMedidaInput) => Promise<string>
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleGuardar() {
    if (!form.medidaPulgadas.trim() || !form.descripcion.trim() || !form.specPropuesta.trim()) {
      setError("Medida en pulgadas, descripción y spec son requeridos.")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onCrearMedida({
        categoria: form.categoria,
        medidaPulgadas: form.medidaPulgadas.trim(),
        descripcion: form.descripcion.trim(),
        specPropuesta: form.specPropuesta.trim(),
        stockInicial: Math.max(0, Math.trunc(Number(form.stockInicial) || 0)),
        precioActualUSD: Math.max(0, Number(form.precioUSD) || 0),
        objetivoPar: form.objetivoPar.trim() ? Math.max(0, Math.trunc(Number(form.objetivoPar))) : null,
        requiereConfirmacion: form.requiereConfirmacion,
        notas: form.notas.trim() || null,
      })
      setForm(INITIAL_FORM)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la nueva medida de endmill.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Agregar Nuevo Endmill al Catálogo
          </DialogTitle>
          <DialogDescription>
            La nueva medida se agregará automáticamente al final de la lista de inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nuevo-categoria">Categoría</Label>
            <select
              id="nuevo-categoria"
              value={form.categoria}
              onChange={(e) => updateField("categoria", e.target.value as CategoriaEndmill)}
              className="w-full rounded-md border border-input bg-card p-2 text-sm font-medium text-foreground focus:border-primary focus:outline-hidden"
            >
              {CATEGORIAS_OPCIONES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nuevo-medida">Medida (Pulgadas) *</Label>
            <Input
              id="nuevo-medida"
              placeholder='e.g. 1/4", 3/8"'
              value={form.medidaPulgadas}
              onChange={(e) => updateField("medidaPulgadas", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nuevo-precio">Precio Unitario (USD) *</Label>
            <Input
              id="nuevo-precio"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.precioUSD}
              onChange={(e) => updateField("precioUSD", e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nuevo-descripcion">Descripción Comercial *</Label>
            <Input
              id="nuevo-descripcion"
              placeholder="e.g. FLAT 4 FILOS 1/4"
              value={form.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nuevo-spec">Especificación Técnica (Spec) *</Label>
            <Input
              id="nuevo-spec"
              placeholder="e.g. D1/4*FL3/4*L50*4F"
              value={form.specPropuesta}
              onChange={(e) => updateField("specPropuesta", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nuevo-stock">Stock Inicial (pzas)</Label>
            <Input
              id="nuevo-stock"
              type="number"
              min={0}
              step={1}
              value={form.stockInicial}
              onChange={(e) => updateField("stockInicial", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nuevo-par">Objetivo PAR (Opcional)</Label>
            <Input
              id="nuevo-par"
              type="number"
              min={0}
              step={1}
              placeholder="Dejar vacío si sin base"
              value={form.objetivoPar}
              onChange={(e) => updateField("objetivoPar", e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2 pt-1">
            <input
              type="checkbox"
              id="nuevo-confirmacion"
              checked={form.requiereConfirmacion}
              onChange={(e) => updateField("requiereConfirmacion", e.target.checked)}
              className="h-4 w-4 rounded-xs border-border text-primary focus:ring-ring"
            />
            <Label htmlFor="nuevo-confirmacion" className="cursor-pointer text-xs font-semibold text-foreground">
              Marcar como pendiente de confirmación (precio/spec con China)
            </Label>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nuevo-notas">Notas Adicionales (Opcional)</Label>
            <Input
              id="nuevo-notas"
              placeholder="e.g. Proveedor especial, recubrimiento TiAlN..."
              value={form.notas}
              onChange={(e) => updateField("notas", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleGuardar()}
            disabled={guardando}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {guardando ? "Guardando..." : "Agregar Endmill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
