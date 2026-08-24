"use client"

import { useEffect, useRef, useState } from "react"
import {
  FileSpreadsheet,
  FileText,
  Sparkles,
  UploadCloud,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  FileCheck2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPrecio } from "@/lib/format"
import {
  parsearTextoExcelEndmills,
  parsearArchivoExcelEndmills,
  type ItemExtraidoEndmill,
  type ResultadoExtraccionEndmills,
} from "@/lib/endmills-extraer-ia"
import type { EndmillMedida, CrearEndmillMedidaInput } from "@/lib/schemas"
import ModalCrearEndmill from "@/app/endmills/components/ModalCrearEndmill"

export interface OpcionesAplicarImportados {
  shippingUSD?: number
  aliCostUSD?: number
  folioCotizacion?: string | null
  actualizarPreciosCatalogo?: boolean
}

export default function ModalImportadorIA({
  abierto,
  onClose,
  medidas,
  onAplicarImportados,
  onCrearMedida,
}: {
  abierto: boolean
  onClose: () => void
  medidas: EndmillMedida[]
  onAplicarImportados: (items: ItemExtraidoEndmill[], opciones?: OpcionesAplicarImportados) => void
  onCrearMedida?: (input: CrearEndmillMedidaInput) => Promise<string>
}) {
  const [tabEntrada, setTabEntrada] = useState<"archivo" | "texto">("archivo")
  const [textoImportar, setTextoImportar] = useState("")
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [etapaCarga, setEtapaCarga] = useState<string>("")
  const [resultadoPreview, setResultadoPreview] = useState<ResultadoExtraccionEndmills | null>(null)
  const [itemsEditables, setItemsEditables] = useState<ItemExtraidoEndmill[]>([])
  const [shippingDetectado, setShippingDetectado] = useState<string>("0")
  const [aliCostDetectado, setAliCostDetectado] = useState<string>("0")
  const [folioDetectado, setFolioDetectado] = useState<string>("")
  const [actualizarPreciosCatalogo, setActualizarPreciosCatalogo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sub-modal para crear medida si una no existe
  const [modalCrearMedidaAbierto, setModalCrearMedidaAbierto] = useState(false)
  const [indiceItemParaCrear, setIndiceItemParaCrear] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Escuchar pegado global (Ctrl + V) mientras el modal esté abierto
  useEffect(() => {
    if (!abierto) return

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return

      // Si pegó una imagen (ej. Screenshot con Win+Shift+S)
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile()
          if (blob) {
            e.preventDefault()
            setArchivoSeleccionado(blob)
            setPreviewUrl(URL.createObjectURL(blob))
            setTabEntrada("archivo")
            toast.info("Captura de pantalla pegada desde el portapapeles")
            return
          }
        }
      }

      // Si pegó texto tabular en la pestaña de archivo, cambiar automáticamente a texto
      const text = e.clipboardData.getData("text")
      if (text && text.includes("\t") && tabEntrada === "archivo" && !archivoSeleccionado) {
        setTextoImportar(text)
        setTabEntrada("texto")
        toast.info("Celdas de Excel detectadas y cargadas")
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [abierto, tabEntrada, archivoSeleccionado])

  function handleFileChange(file: File) {
    setArchivoSeleccionado(file)
    setError(null)
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  async function procesarExtraccion() {
    setError(null)
    setProcesando(true)

    try {
      // 1. Si el usuario subió un archivo (Excel, PDF, Imagen)
      if (tabEntrada === "archivo" && archivoSeleccionado) {
        setEtapaCarga("Analizando archivo con motor multimodal...")

        const nombre = archivoSeleccionado.name.toLowerCase()
        // Si es Excel (.xlsx, .xls, .csv), probar parser nativo primero
        if (nombre.endsWith(".xlsx") || nombre.endsWith(".xls") || nombre.endsWith(".csv")) {
          try {
            const buffer = await archivoSeleccionado.arrayBuffer()
            const parseado = parsearArchivoExcelEndmills(buffer, medidas)
            if (parseado.items.length > 0) {
              setResultadoPreview(parseado)
              setItemsEditables(parseado.items)
              setShippingDetectado(String(parseado.shippingUSD || 0))
              setAliCostDetectado(String(parseado.aliCostUSD || 0))
              setFolioDetectado(parseado.folioCotizacion || "")
              return
            }
          } catch (eExcel) {
            console.warn("Fallo parser nativo Excel, enviando a API...", eExcel)
          }
        }

        // Si es PDF, Imagen o requiere inferencia Gemini
        const formData = new FormData()
        formData.append("archivo", archivoSeleccionado)

        const res = await fetch("/api/endmills/extraer-pedido", {
          method: "POST",
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Error extrayendo datos con IA")

        setResultadoPreview(data)
        setItemsEditables(data.items || [])
        setShippingDetectado(String(data.shippingUSD || 0))
        setAliCostDetectado(String(data.aliCostUSD || 0))
        setFolioDetectado(data.folioCotizacion || "")
        return
      }

      // 2. Si el usuario ingresó texto o celdas
      if (textoImportar.trim()) {
        setEtapaCarga("Analizando texto con catálogo...")

        // Probar primero parser nativo TSV
        const nativo = parsearTextoExcelEndmills(textoImportar, medidas)
        if (nativo.length > 0 && nativo.some((i) => i.medidaIdCoincidencia !== null)) {
          const resNat: ResultadoExtraccionEndmills = {
            origen: "excel_tsv",
            items: nativo,
          }
          setResultadoPreview(resNat)
          setItemsEditables(nativo)
          return
        }

        // Si no es tabular simple, invocar API de Gemini
        const res = await fetch("/api/endmills/extraer-pedido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: textoImportar }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Error analizando con IA")

        setResultadoPreview(data)
        setItemsEditables(data.items || [])
        setShippingDetectado(String(data.shippingUSD || 0))
        setAliCostDetectado(String(data.aliCostUSD || 0))
        setFolioDetectado(data.folioCotizacion || "")
        return
      }

      setError("Selecciona un archivo o escribe texto para analizar.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error durante el procesamiento.")
    } finally {
      setProcesando(false)
      setEtapaCarga("")
    }
  }

  function handleActualizarFilaEditable(
    index: number,
    cambios: Partial<ItemExtraidoEndmill>
  ) {
    setItemsEditables((prev) => {
      const nuevo = [...prev]
      const actual = nuevo[index]
      if (!actual) return prev

      const actualizado = { ...actual, ...cambios }

      // Si cambió la medida asignada
      if (cambios.medidaIdCoincidencia !== undefined) {
        const encontrada = medidas.find((m) => m.id === cambios.medidaIdCoincidencia)
        if (encontrada) {
          actualizado.medidaIdCoincidencia = encontrada.id
          actualizado.medidaPulgadas = encontrada.medidaPulgadas
          actualizado.nivelCoincidencia = "exacto"
          actualizado.precioCatalogoUSD = encontrada.precioActualUSD
          actualizado.notaMatch = `Coincidencia manual con ${encontrada.descripcion}`
          if (actualizado.precioUnitarioUSD > 0) {
            actualizado.diferenciaPrecio =
              Math.round((actualizado.precioUnitarioUSD - encontrada.precioActualUSD) * 100) / 100
          }
        } else {
          actualizado.medidaIdCoincidencia = null
          actualizado.nivelCoincidencia = "nuevo"
          actualizado.precioCatalogoUSD = undefined
          actualizado.diferenciaPrecio = 0
          actualizado.notaMatch = "Sin coincidencia (ítem nuevo)"
        }
      }

      // Si cambió el precio
      if (cambios.precioUnitarioUSD !== undefined && actualizado.precioCatalogoUSD !== undefined) {
        actualizado.diferenciaPrecio =
          Math.round((cambios.precioUnitarioUSD - actualizado.precioCatalogoUSD) * 100) / 100
      }

      nuevo[index] = actualizado
      return nuevo
    })
  }

  function handleCrearMedidaDesdeItem(index: number) {
    setIndiceItemParaCrear(index)
    setModalCrearMedidaAbierto(true)
  }

  async function handleMedidaCreada(input: CrearEndmillMedidaInput): Promise<string> {
    if (!onCrearMedida) throw new Error("No hay manejador para crear medidas")
    const id = await onCrearMedida(input)
    if (indiceItemParaCrear !== null && itemsEditables[indiceItemParaCrear]) {
      handleActualizarFilaEditable(indiceItemParaCrear, {
        medidaIdCoincidencia: id,
        medidaPulgadas: input.medidaPulgadas,
        nivelCoincidencia: "exacto",
        precioCatalogoUSD: input.precioActualUSD,
        precioUnitarioUSD: input.precioActualUSD,
        notaMatch: `Creada en catálogo: ${input.descripcion}`,
      })
      toast.success(`Medida ${input.medidaPulgadas} creada y vinculada al pedido`)
    }
    setModalCrearMedidaAbierto(false)
    setIndiceItemParaCrear(null)
    return id
  }

  function handleAplicarAlPedido() {
    if (itemsEditables.length === 0) return

    onAplicarImportados(itemsEditables, {
      shippingUSD: Number(shippingDetectado) || 0,
      aliCostUSD: Number(aliCostDetectado) || 0,
      folioCotizacion: folioDetectado.trim() || null,
      actualizarPreciosCatalogo,
    })

    // Limpiar estado
    setArchivoSeleccionado(null)
    setPreviewUrl(null)
    setTextoImportar("")
    setResultadoPreview(null)
    setItemsEditables([])
    onClose()
  }

  function reiniciar() {
    setArchivoSeleccionado(null)
    setPreviewUrl(null)
    setTextoImportar("")
    setResultadoPreview(null)
    setItemsEditables([])
    setError(null)
  }

  return (
    <>
      <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> Importar Solicitud con IA Multimodal / Excel
            </DialogTitle>
            <DialogDescription>
              Sube proformas o cotizaciones de Rita (ChangZhou) en <strong>PDF</strong>, <strong>Excel (.xlsx)</strong>,{" "}
              <strong>capturas de WeChat / WhatsApp</strong> o pega celdas con <code>Ctrl + V</code>.
            </DialogDescription>
          </DialogHeader>

          {!resultadoPreview ? (
            <div className="space-y-4 py-2">
              {/* Selector de tipo de entrada */}
              <div className="flex rounded-lg bg-muted p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTabEntrada("archivo")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 transition-colors ${
                    tabEntrada === "archivo"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UploadCloud className="h-4 w-4 text-primary" /> Subir Archivo / PDF / Imagen / Excel
                </button>
                <button
                  type="button"
                  onClick={() => setTabEntrada("texto")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 transition-colors ${
                    tabEntrada === "texto"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Pegar Texto / Celdas de Excel
                </button>
              </div>

              {tabEntrada === "archivo" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setArrastrando(true)
                  }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setArrastrando(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileChange(file)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    arrastrando
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card/60 hover:border-primary/60 hover:bg-muted/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileChange(file)
                    }}
                  />

                  {archivoSeleccionado ? (
                    <div className="flex flex-col items-center gap-3">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Vista previa"
                          className="max-h-36 rounded-md border border-border object-contain shadow-xs"
                        />
                      ) : archivoSeleccionado.name.toLowerCase().endsWith(".pdf") ? (
                        <FileText className="h-12 w-12 text-rose-600" />
                      ) : (
                        <FileSpreadsheet className="h-12 w-12 text-emerald-600" />
                      )}

                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span>{archivoSeleccionado.name}</span>
                        <span className="text-muted-foreground">
                          ({(archivoSeleccionado.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setArchivoSeleccionado(null)
                            setPreviewUrl(null)
                          }}
                          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-3 text-primary">
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        Arrastra y suelta tu archivo aquí o haz clic para explorar
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Soporta <strong>PDF</strong>, <strong>Excel (.xlsx/.csv)</strong>,{" "}
                        <strong>Imágenes (PNG/JPG)</strong> o presiona <code>Ctrl + V</code>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="texto-importar" className="text-xs font-bold text-foreground">
                    Pegar celdas de Excel o texto de chat / correo (Ctrl + V)
                  </Label>
                  <textarea
                    id="texto-importar"
                    rows={6}
                    value={textoImportar}
                    onChange={(e) => setTextoImportar(e.target.value)}
                    placeholder={`Ejemplo copiado de Excel:\n1/4 FLAT 4 FILOS\t10\t7.92\n1/8 BALL 2 FILOS\t20\t5.50\n\nO texto de WhatsApp/WeChat:\nHi Rita, we need 10 pcs 1/4 Flat 4F and 20 pcs 1/8 Ball 2F.`}
                    className="w-full rounded-md border border-input bg-muted p-3 font-mono text-xs text-foreground focus:border-primary focus:bg-card focus:outline-hidden"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={() => void procesarExtraccion()}
                disabled={procesando || (!archivoSeleccionado && !textoImportar.trim())}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 gap-2"
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {etapaCarga || "Analizando con IA y Catálogo..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analizar e Identificar Partidas
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Vista de Resultados y Mapeo */
            <div className="space-y-4 py-2">
              {/* Barra superior de resumen */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    <FileCheck2 className="h-4 w-4 text-emerald-600" />
                    {itemsEditables.length} partidas detectadas
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                    Origen: {resultadoPreview.origen}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="font-semibold text-primary hover:underline"
                  >
                    Volver a subir archivo
                  </button>
                </div>
              </div>

              {/* Campos adicionales detectados (Folio, Shipping, AliCost) */}
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="folio-cotizacion" className="text-[11px] font-bold text-foreground">
                    Folio / Ref. Cotización
                  </Label>
                  <Input
                    id="folio-cotizacion"
                    placeholder="e.g. PI-2026-CH88"
                    value={folioDetectado}
                    onChange={(e) => setFolioDetectado(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="shipping-usd" className="text-[11px] font-bold text-foreground">
                    Flete / Shipping USD
                  </Label>
                  <Input
                    id="shipping-usd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={shippingDetectado}
                    onChange={(e) => setShippingDetectado(e.target.value)}
                    className="h-8 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="alicost-usd" className="text-[11px] font-bold text-foreground">
                    Ali Cost / Comisión USD
                  </Label>
                  <Input
                    id="alicost-usd"
                    type="number"
                    min={0}
                    step={0.01}
                    value={aliCostDetectado}
                    onChange={(e) => setAliCostDetectado(e.target.value)}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Tabla de Partidas */}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card text-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/70">
                      <TableHead className="w-1/3">Descripción Detectada / Spec</TableHead>
                      <TableHead className="w-1/3">Coincidencia en Catálogo Vivo</TableHead>
                      <TableHead className="text-right w-20">Cantidad</TableHead>
                      <TableHead className="text-right w-24">Precio USD</TableHead>
                      <TableHead className="text-right w-24">Variación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsEditables.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-semibold text-foreground">{item.descripcionInput}</div>
                          {item.specDetectada && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {item.specDetectada}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <select
                              value={item.medidaIdCoincidencia || ""}
                              onChange={(e) =>
                                handleActualizarFilaEditable(idx, {
                                  medidaIdCoincidencia: e.target.value || null,
                                })
                              }
                              className={`w-full rounded border p-1 text-[11px] font-medium ${
                                item.nivelCoincidencia === "exacto"
                                  ? "border-emerald-300 bg-emerald-50/50 text-emerald-900"
                                  : item.nivelCoincidencia === "aproximado"
                                  ? "border-amber-300 bg-amber-50/50 text-amber-900"
                                  : "border-sky-300 bg-sky-50/50 text-sky-900"
                              }`}
                            >
                              <option value="">-- No catalogada (Ítem Nuevo) --</option>
                              {medidas.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.medidaPulgadas}&quot; {m.descripcion} ({formatPrecio(m.precioActualUSD, "USD")})
                                </option>
                              ))}
                            </select>

                            {item.nivelCoincidencia === "nuevo" && onCrearMedida && (
                              <button
                                type="button"
                                onClick={() => handleCrearMedidaDesdeItem(idx)}
                                className="flex items-center gap-1 text-[10px] font-bold text-sky-700 hover:underline"
                              >
                                <PlusCircle className="h-3 w-3" /> + Agregar a catálogo
                              </button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={item.cantidadPedida}
                            onChange={(e) =>
                              handleActualizarFilaEditable(idx, {
                                cantidadPedida: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="h-7 w-16 text-right font-black font-mono"
                          />
                        </TableCell>

                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.precioUnitarioUSD}
                            onChange={(e) =>
                              handleActualizarFilaEditable(idx, {
                                precioUnitarioUSD: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="h-7 w-20 text-right font-bold text-emerald-700 font-mono"
                          />
                        </TableCell>

                        <TableCell className="text-right font-mono text-[11px]">
                          {item.diferenciaPrecio !== undefined && item.diferenciaPrecio !== 0 ? (
                            item.diferenciaPrecio > 0 ? (
                              <span className="flex items-center justify-end gap-0.5 text-rose-600 font-bold">
                                <TrendingUp className="h-3 w-3" /> +${item.diferenciaPrecio.toFixed(2)}
                              </span>
                            ) : (
                              <span className="flex items-center justify-end gap-0.5 text-emerald-600 font-bold">
                                <TrendingDown className="h-3 w-3" /> -${Math.abs(item.diferenciaPrecio).toFixed(2)}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">= Igual</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Opción de actualizar precios de catálogo */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  id="chk-actualizar-precios"
                  checked={actualizarPreciosCatalogo}
                  onChange={(e) => setActualizarPreciosCatalogo(e.target.checked)}
                  className="h-4 w-4 rounded-xs border-border text-primary focus:ring-ring"
                />
                <Label htmlFor="chk-actualizar-precios" className="cursor-pointer font-medium text-foreground">
                  Actualizar precios en el catálogo de medidas con los precios de esta cotización
                </Label>
              </div>

              {/* Botón de acción final */}
              <Button
                onClick={handleAplicarAlPedido}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 text-sm gap-2"
              >
                <FileCheck2 className="h-4 w-4" />
                Cargar {itemsEditables.filter((i) => i.medidaIdCoincidencia !== null).length} partidas al pedido
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal auxiliar para crear medida si el usuario hace clic en '+ Agregar a catálogo' */}
      {modalCrearMedidaAbierto && indiceItemParaCrear !== null && (
        <ModalCrearEndmill
          abierto={modalCrearMedidaAbierto}
          onClose={() => {
            setModalCrearMedidaAbierto(false)
            setIndiceItemParaCrear(null)
          }}
          onCrearMedida={handleMedidaCreada}
        />
      )}
    </>
  )
}
