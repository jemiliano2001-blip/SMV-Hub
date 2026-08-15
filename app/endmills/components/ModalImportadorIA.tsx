"use client"

import { useState } from "react"
import { FileSpreadsheet, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPrecio } from "@/lib/format"
import { parsearTextoExcelEndmills, type ItemExtraidoEndmill } from "@/lib/endmills-extraer-ia"
import type { EndmillMedida } from "@/lib/schemas"

export default function ModalImportadorIA({
  abierto,
  onClose,
  medidas,
  onAplicarImportados,
}: {
  abierto: boolean
  onClose: () => void
  medidas: EndmillMedida[]
  onAplicarImportados: (items: ItemExtraidoEndmill[]) => void
}) {
  const [textoImportar, setTextoImportar] = useState("")
  const [procesandoImportacion, setProcesandoImportacion] = useState(false)
  const [itemsImportadosPreview, setItemsImportadosPreview] = useState<ItemExtraidoEndmill[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function procesarAnalisisIA() {
    if (!textoImportar.trim()) {
      setError("Ingresa texto o celdas de Excel para analizar.")
      return
    }
    setProcesandoImportacion(true)
    setError(null)
    try {
      // 1. Probar parser nativo si viene de celdas copiadas de Excel
      const nativo = parsearTextoExcelEndmills(textoImportar, medidas)
      if (nativo.length > 0 && nativo.some((i) => i.medidaIdCoincidencia !== null)) {
        setItemsImportadosPreview(nativo)
        return
      }

      // 2. Si no es formato nativo estricto, llamar a la API de Gemini
      const res = await fetch("/api/endmills/extraer-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoImportar }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error analizando con IA")
      setItemsImportadosPreview(data.items || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error procesando extracción.")
    } finally {
      setProcesandoImportacion(false)
    }
  }

  function handleAplicar() {
    if (!itemsImportadosPreview || itemsImportadosPreview.length === 0) return
    onAplicarImportados(itemsImportadosPreview)
    setTextoImportar("")
    setItemsImportadosPreview(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-900">
            <Sparkles className="h-5 w-5 text-purple-600" /> Importar Solicitud con IA / Excel
          </DialogTitle>
          <DialogDescription>
            Pega celdas copiadas directamente de Excel o escribe el texto de tu solicitud. La IA de Gemini realizará el pareo automático con tu catálogo de endmills.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="texto-importar" className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Pegar celdas de Excel o texto de solicitud (Ctrl + V)
            </Label>
            <textarea
              id="texto-importar"
              rows={6}
              value={textoImportar}
              onChange={(e) => setTextoImportar(e.target.value)}
              placeholder={`Ejemplo copiado de Excel:\n1/4 FLAT 4 FILOS\t10\t7.92\n1/8 BALL 2 FILOS\t20\t5.50\n\nO texto libre:\nNecesitamos 10 piezas de fresa flat 1/4 y 20 piezas de ball 1/8.`}
              className="w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs focus:border-purple-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          {!itemsImportadosPreview ? (
            <Button
              onClick={() => void procesarAnalisisIA()}
              disabled={procesandoImportacion || !textoImportar.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-2.5"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {procesandoImportacion ? "Analizando coincidencia con Gemini IA..." : "Analizar e Identificar Piezas"}
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                <span>Piezas Identificadas ({itemsImportadosPreview.length})</span>
                <button
                  type="button"
                  onClick={() => setItemsImportadosPreview(null)}
                  className="text-purple-600 hover:underline"
                >
                  Limpiar y volver a intentar
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded border bg-white text-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Texto detectado</TableHead>
                      <TableHead>Pulgadas</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio USD</TableHead>
                      <TableHead>Estado Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsImportadosPreview.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.descripcionInput}</TableCell>
                        <TableCell className="font-mono">{item.medidaPulgadas}</TableCell>
                        <TableCell className="text-right font-black">{item.cantidadPedida}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {formatPrecio(item.precioUnitarioUSD, "USD")}
                        </TableCell>
                        <TableCell>
                          {item.nivelCoincidencia === "exacto" && (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              🟢 Exacto
                            </span>
                          )}
                          {item.nivelCoincidencia === "aproximado" && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              🟡 Sugerido
                            </span>
                          )}
                          {item.nivelCoincidencia === "nuevo" && (
                            <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                              🔵 Nuevo
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                onClick={handleAplicar}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2"
              >
                Cargar {itemsImportadosPreview.filter((i) => i.medidaIdCoincidencia !== null).length} partidas al pedido
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-rose-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
