"use client"

import { useMemo, useState } from "react"
import { Printer, Tag, CheckSquare, Square } from "lucide-react"
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
import type { EndmillMedida } from "@/lib/schemas"

export default function ModalEtiquetasEndmills({
  abierto,
  onClose,
  medidas,
}: {
  abierto: boolean
  onClose: () => void
  medidas: EndmillMedida[]
}) {
  const [seleccionadas, setSeleccionadas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(medidas.map((m) => [m.id, true]))
  )
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [busqueda, setBusqueda] = useState("")

  const seleccionadasCount = useMemo(
    () => Object.values(seleccionadas).filter(Boolean).length,
    [seleccionadas]
  )

  function toggleTodas(valor: boolean) {
    const nuevo: Record<string, boolean> = {}
    for (const m of medidas) {
      nuevo[m.id] = valor
    }
    setSeleccionadas(nuevo)
  }

  function handleImprimir() {
    window.print()
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl print:p-0 print:border-0 print:max-h-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            <Tag className="h-5 w-5 text-primary" /> Generador de Etiquetas para Gaveteros / Cajones
          </DialogTitle>
          <DialogDescription>
            Selecciona las medidas para imprimir etiquetas organizadoras de taller para cajones y gavetas.
          </DialogDescription>
        </DialogHeader>

        {/* Panel de Control y Filtros (Oculto en Impresión) */}
        <div className="space-y-3 py-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted p-2 text-xs">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleTodas(true)}
                className="h-7 text-xs font-semibold"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Seleccionar Todas ({medidas.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleTodas(false)}
                className="h-7 text-xs font-semibold"
              >
                <Square className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Deseleccionar Todas
              </Button>
            </div>

            <div className="flex items-center gap-2 font-bold text-foreground">
              <span>{seleccionadasCount} etiquetas seleccionadas</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Filtrar medidas..."
              className="h-8 w-48 text-xs bg-card"
            />
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs font-medium text-foreground focus:outline-hidden"
            >
              <option value="todas">Todas las categorías</option>
              <option value="FLAT">Flat</option>
              <option value="BALL">Ball</option>
              <option value="LARGO_FLAT">Largo Flat</option>
              <option value="LARGO_BOLA">Largo Bola</option>
              <option value="EXTRA_LARGO_FLAT">Extra Largo Flat</option>
              <option value="EXTRA_LARGO_BOLA">Extra Largo Bola</option>
              <option value="RUPA_CARBURO">Rupa / Carburo</option>
            </select>
          </div>
        </div>

        {/* Hoja de Etiquetas Imprimibles */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 print:border-0 print:bg-white print:p-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
            {medidas
              .filter((m) => seleccionadas[m.id])
              .map((medida) => (
                <div
                  key={medida.id}
                  className="relative flex flex-col justify-between rounded-lg border-2 border-border bg-card p-3 text-foreground shadow-xs print:border-2 print:border-black print:bg-white print:text-black print:p-2.5 print:shadow-none"
                >
                  {/* Encabezado con Medida y Logo SMV */}
                  <div className="flex items-start justify-between border-b border-border pb-1.5 print:border-black print:pb-1">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground print:text-black">
                        {medida.categoria.replace("_", " ")}
                      </span>
                      <div className="font-mono text-2xl font-black leading-tight text-foreground print:text-black print:text-xl">
                        {medida.medidaPulgadas}&quot;
                      </div>
                    </div>
                    <div className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-black tracking-widest text-primary-foreground print:bg-black print:text-white">
                      SMV
                    </div>
                  </div>

                  {/* Descripción y Spec */}
                  <div className="py-2 print:py-1">
                    <div className="text-xs font-bold leading-snug text-foreground print:text-black">
                      {medida.descripcion}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-muted-foreground truncate print:text-black">
                      {medida.specPropuesta}
                    </div>
                  </div>

                  {/* Pie con Stock Objetivo y Espacio para Conteo */}
                  <div className="flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground print:border-black print:text-black print:pt-1">
                    <div>
                      PAR: <strong className="font-mono font-bold text-foreground print:text-black">{medida.objetivoPar ?? "—"}</strong>
                    </div>
                    <div className="text-right font-mono text-[9px] text-muted-foreground print:text-black">
                      ID: {medida.id.slice(-6)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            onClick={handleImprimir}
            disabled={seleccionadasCount === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir {seleccionadasCount} Etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
