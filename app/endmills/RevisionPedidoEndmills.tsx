"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  ClipboardCopy,
  MessageSquare,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  DollarSign,
  Printer,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  calcularAhorroPedidoUSA,
  calcularCantidadSugerida,
  calcularTotalesPedidoEndmills,
  generarEmailPedidoEndmills,
  generarTextoWeChat,
  generarTextoWhatsApp,
  redondearUSD,
} from "@/lib/endmills-calculos"
import { fechaHoyLocal, formatPrecio } from "@/lib/format"
import type { ItemExtraidoEndmill } from "@/lib/endmills-extraer-ia"
import type { ActorEndmills } from "@/lib/endmills"
import type {
  CrearEndmillMedidaInput,
  EndmillMedida,
  PedidoEndmills,
  RegistrarPedidoEndmillsInput,
} from "@/lib/schemas"
import ModalImportadorIA, {
  type OpcionesAplicarImportados,
} from "@/app/endmills/components/ModalImportadorIA"

interface FilaBorrador {
  cantidad: number
  precio: number
  confirmada: boolean
}

const PROVEEDOR = {
  nombre: "ChangZhou North Alloy Tool Co.,Ltd",
  contacto: "Rita",
  email: "bfl9@bfltool.com",
  origen: "China",
}

export default function RevisionPedidoEndmills({
  medidas,
  ultimoPedido,
  actor,
  onRegistrar,
  onCrearMedida,
  onClose,
}: {
  medidas: EndmillMedida[]
  ultimoPedido: PedidoEndmills | null
  actor: ActorEndmills
  onRegistrar: (input: RegistrarPedidoEndmillsInput, actor: ActorEndmills) => Promise<string>
  onCrearMedida?: (input: CrearEndmillMedidaInput) => Promise<string>
  onClose: () => void
}) {
  const [filas, setFilas] = useState<Record<string, FilaBorrador>>(() =>
    Object.fromEntries(
      medidas.map((medida) => [
        medida.id,
        {
          cantidad: calcularCantidadSugerida(medida.objetivoPar, medida.stockActual) ?? 0,
          precio: medida.precioActualUSD,
          confirmada: !medida.requiereConfirmacion,
        },
      ])
    )
  )
  const [fecha, setFecha] = useState(fechaHoyLocal())
  const [numeroProveedor, setNumeroProveedor] = useState("")
  const [aliCost, setAliCost] = useState("0")
  const [shipping, setShipping] = useState("0")
  const [tipoCambio, setTipoCambio] = useState("")
  const [adicionalesConfirmados, setAdicionalesConfirmados] = useState(false)
  const [revisionHumana, setRevisionHumana] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  // Estado para filtrado de tabla y buscador interno del modal
  const [vistaItems, setVistaItems] = useState<"solicitados" | "todos">("solicitados")
  const [busquedaInterna, setBusquedaInterna] = useState("")

  // Estado para el modal de Importador Inteligente IA / Excel
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false)

  const seleccionadas = useMemo(
    () => medidas.filter((medida) => filas[medida.id]?.cantidad > 0),
    [medidas, filas]
  )

  const totales = useMemo(
    () =>
      calcularTotalesPedidoEndmills(
        seleccionadas.map((medida) => ({
          cantidadPedida: filas[medida.id].cantidad,
          precioUnitarioUSD: filas[medida.id].precio,
        })),
        Number(aliCost) || 0,
        Number(shipping) || 0
      ),
    [seleccionadas, filas, aliCost, shipping]
  )

  const ahorroBenchmarkUSA = useMemo(() => {
    return calcularAhorroPedidoUSA(
      seleccionadas.map((medida) => ({
        medidaPulgadas: medida.medidaPulgadas,
        categoria: medida.categoria,
        cantidad: filas[medida.id].cantidad,
        precioUnitarioUSD: filas[medida.id].precio,
      }))
    )
  }, [seleccionadas, filas])

  const totalMXNEstimado = useMemo(() => {
    const tc = Number(tipoCambio)
    if (!tc || tc <= 0 || !adicionalesConfirmados) return null
    return totales.totalUSD * tc
  }, [tipoCambio, adicionalesConfirmados, totales.totalUSD])

  const medidasVisibles = useMemo(() => {
    const q = busquedaInterna.trim().toLowerCase()
    return medidas.filter((medida) => {
      const cantidad = filas[medida.id]?.cantidad ?? 0
      if (vistaItems === "solicitados" && cantidad <= 0) return false
      if (!q) return true
      return [medida.descripcion, medida.medidaPulgadas, medida.specPropuesta]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [medidas, filas, vistaItems, busquedaInterna])

  function aplicarImportadosAlPedido(
    items: ItemExtraidoEndmill[],
    opciones?: OpcionesAplicarImportados
  ) {
    const nuevasFilas = { ...filas }
    let aplicados = 0

    for (const item of items) {
      if (item.medidaIdCoincidencia && nuevasFilas[item.medidaIdCoincidencia]) {
        nuevasFilas[item.medidaIdCoincidencia] = {
          ...nuevasFilas[item.medidaIdCoincidencia],
          cantidad: item.cantidadPedida,
          precio:
            item.precioUnitarioUSD > 0
              ? item.precioUnitarioUSD
              : nuevasFilas[item.medidaIdCoincidencia].precio,
        }
        aplicados++
      }
    }

    setFilas(nuevasFilas)
    setVistaItems("solicitados")

    if (opciones?.shippingUSD !== undefined && opciones.shippingUSD > 0) {
      setShipping(String(opciones.shippingUSD))
    }
    if (opciones?.aliCostUSD !== undefined && opciones.aliCostUSD > 0) {
      setAliCost(String(opciones.aliCostUSD))
    }
    if (opciones?.folioCotizacion) {
      setNumeroProveedor(opciones.folioCotizacion)
    }

    setMensaje(`Se importaron y aplicaron ${aplicados} partidas al pedido.`)
    toast.success(`Cargadas ${aplicados} partidas de la cotización con éxito`)
  }

  function cargarSugeridosStockBajo() {
    const nuevas = { ...filas }
    let cargados = 0

    for (const m of medidas) {
      const sug = calcularCantidadSugerida(m.objetivoPar, m.stockActual)
      if (sug !== null && sug > 0) {
        nuevas[m.id] = {
          ...nuevas[m.id],
          cantidad: sug,
        }
        cargados++
      }
    }

    setFilas(nuevas)
    setVistaItems("solicitados")
    toast.success(`Cargadas ${cargados} herramientas con necesidad de reabastecimiento PAR`)
  }

  function actualizarFila(id: string, cambios: Partial<FilaBorrador>) {
    setFilas((actuales) => ({
      ...actuales,
      [id]: { ...actuales[id], ...cambios },
    }))
  }

  function tablaTexto(separador = "\t") {
    return [
      ["Medida", "Descripción", "Spec", "Cantidad", "Precio USD", "Subtotal USD"].join(separador),
      ...seleccionadas.map((medida) => {
        const fila = filas[medida.id]
        return [
          medida.medidaPulgadas,
          medida.descripcion,
          medida.specPropuesta,
          fila.cantidad,
          fila.precio.toFixed(2),
          (fila.cantidad * fila.precio).toFixed(2),
        ]
          .map((valor) => `"${String(valor).replaceAll('"', '""')}"`)
          .join(separador)
      }),
    ].join("\n")
  }

  async function copiarTabla() {
    await navigator.clipboard.writeText(tablaTexto("\t"))
    toast.info("Tabla copiada al portapapeles en formato TSV")
  }

  async function copiarWhatsApp() {
    const texto = generarTextoWhatsApp(
      seleccionadas,
      filas,
      Number(shipping) || 0,
      Number(aliCost) || 0
    )
    await navigator.clipboard.writeText(texto)
    toast.success("Mensaje para WhatsApp copiado con emojis y desglose en USD")
  }

  async function copiarWeChat() {
    const texto = generarTextoWeChat(seleccionadas, filas)
    await navigator.clipboard.writeText(texto)
    toast.success("Texto formateado para WeChat copiado")
  }

  function descargarExcelPO() {
    const wsData = [
      ["SMV MAQUINADOS - PURCHASE ORDER"],
      [`Supplier: ${PROVEEDOR.nombre}`],
      [`Contact: ${PROVEEDOR.contacto} (${PROVEEDOR.email})`],
      [`Date: ${fecha}`, `Supplier Ref / Folio: ${numeroProveedor || "N/A"}`],
      [],
      ["Item", "Size (Inch)", "Description", "Spec", "Quantity (pcs)", "Unit Price (USD)", "Subtotal (USD)"],
      ...seleccionadas.map((m, idx) => {
        const fila = filas[m.id]
        return [
          idx + 1,
          m.medidaPulgadas,
          m.descripcion,
          m.specPropuesta,
          fila.cantidad,
          fila.precio,
          redondearUSD(fila.cantidad * fila.precio),
        ]
      }),
      [],
      ["", "", "", "", "", "Items Subtotal:", totales.costoItemsUSD],
      ["", "", "", "", "", "Shipping (DHL/FedEx):", Number(shipping) || 0],
      ["", "", "", "", "", "Alibaba / Fee:", Number(aliCost) || 0],
      ["", "", "", "", "", "TOTAL USD:", totales.totalUSD],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Order")
    XLSX.writeFile(wb, `PO_SMV_Endmills_${fecha}_${numeroProveedor || "Rita"}.xlsx`)
    toast.success("Orden de compra descargada en Excel (.xlsx)")
  }

  function abrirCorreo() {
    const { mailtoUrl } = generarEmailPedidoEndmills(
      seleccionadas,
      filas,
      PROVEEDOR,
      Number(shipping) || 0,
      Number(aliCost) || 0,
      numeroProveedor || undefined
    )
    window.location.href = mailtoUrl
  }

  function imprimirPO() {
    window.print()
  }

  async function registrar() {
    setError(null)
    setMensaje(null)
    if (seleccionadas.length === 0) {
      setError("Selecciona al menos una medida con cantidad mayor a cero.")
      return
    }
    const sinConfirmar = seleccionadas.find(
      (medida) => medida.requiereConfirmacion && !filas[medida.id].confirmada
    )
    if (sinConfirmar) {
      setError(`Confirma spec y precio de ${sinConfirmar.descripcion}.`)
      return
    }
    if (!revisionHumana) {
      setError("Confirma que revisaste cantidades, precios y especificaciones.")
      return
    }
    setGuardando(true)
    try {
      await onRegistrar(
        {
          fecha,
          numeroProveedor: numeroProveedor.trim() || null,
          proveedor: PROVEEDOR,
          aliCostUSD: Number(aliCost) || 0,
          shippingUSD: Number(shipping) || 0,
          tipoCambioUSD: Number(tipoCambio) > 0 ? Number(tipoCambio) : null,
          costosAdicionalesConfirmados: adicionalesConfirmados,
          partidas: seleccionadas.map((medida) => ({
            medidaId: medida.id,
            stockRevisado: medida.stockActual,
            cantidadPedida: filas[medida.id].cantidad,
            precioUnitarioUSD: filas[medida.id].precio,
            confirmacionResuelta: filas[medida.id].confirmada,
          })),
        },
        actor
      )
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el pedido.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-6xl print:max-h-none print:overflow-visible print:border-0 print:p-0">
          <DialogHeader className="border-b px-5 py-4 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle className="text-lg">Revisar pedido de Endmills China</DialogTitle>
                <DialogDescription>
                  Las cantidades y precios son editables. Exporta a WhatsApp/Email para Rita o confirma el registro.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cargarSugeridosStockBajo}
                  className="font-bold text-xs gap-1.5 border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-600" /> Cargar sugeridos PAR
                </Button>
                <Button
                  onClick={() => {
                    setError(null)
                    setModalImportarAbierto(true)
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs shrink-0 gap-1.5"
                >
                  <Sparkles className="h-4 w-4 animate-pulse" aria-hidden /> Importar Solicitud (IA / Excel)
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 pb-5 lg:grid-cols-[1fr_280px] print:block print:p-6 print:overflow-visible">
            <div className="min-w-0 space-y-3">
              {/* Encabezado formal de la Orden de Compra (Visible en pantalla y print) */}
              <div className="grid gap-3 pt-1 sm:grid-cols-3 print:grid-cols-3 print:border-b print:pb-4">
                <div>
                  <Label htmlFor="pedido-fecha" className="text-xs">Fecha del Pedido</Label>
                  <Input
                    id="pedido-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="pedido-numero" className="text-xs">Folio / Proforma Proveedor</Label>
                  <Input
                    id="pedido-numero"
                    value={numeroProveedor}
                    onChange={(e) => setNumeroProveedor(e.target.value)}
                    placeholder="e.g. PI-2026-CH88"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="rounded-lg border bg-muted px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground text-[10px]">Proveedor Internacional</span>
                  <div className="font-bold text-foreground">Rita · ChangZhou North Alloy Tool</div>
                  <div className="text-[10px] text-muted-foreground">{PROVEEDOR.email}</div>
                </div>
              </div>

              {/* Barra de herramientas de vista y búsqueda interna del pedido */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted p-2 text-xs print:hidden">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setVistaItems("solicitados")}
                    className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                      vistaItems === "solicitados"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Solo Ítems Solicitados ({seleccionadas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaItems("todos")}
                    className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                      vistaItems === "todos"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Ver Todo el Catálogo ({medidas.length})
                  </button>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={busquedaInterna}
                    onChange={(e) => setBusquedaInterna(e.target.value)}
                    placeholder="Filtrar medida o spec..."
                    className="h-8 pl-8 text-xs bg-card"
                  />
                </div>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border print:max-h-none print:border-black">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card print:static">
                    <TableRow className="bg-muted/70">
                      <TableHead>Medida / Descripción / Spec</TableHead>
                      <TableHead className="w-20 text-right print:hidden">Stock</TableHead>
                      <TableHead className="w-24 text-right">Cantidad</TableHead>
                      <TableHead className="w-28 text-right">Precio USD</TableHead>
                      <TableHead className="w-28 text-right">Subtotal USD</TableHead>
                      <TableHead className="w-24 print:hidden">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medidasVisibles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                          {vistaItems === "solicitados"
                            ? "No hay partidas con cantidad > 0. Usa el botón 'Importar Solicitud (IA / Excel)' o presiona 'Cargar sugeridos PAR'."
                            : "No se encontraron medidas que coincidan con la búsqueda."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      medidasVisibles.map((medida) => {
                        const fila = filas[medida.id]
                        const sinBase = medida.objetivoPar === null
                        const subtotalFila = redondearUSD(fila.cantidad * fila.precio)

                        return (
                          <TableRow
                            key={medida.id}
                            className={medida.requiereConfirmacion ? "bg-amber-50/50" : ""}
                          >
                            <TableCell className="max-w-sm whitespace-normal">
                              <div className="font-semibold text-foreground">
                                {medida.medidaPulgadas}&quot; · {medida.descripcion}
                              </div>
                              <div className="truncate font-mono text-[10px] text-muted-foreground">
                                {medida.specPropuesta}
                              </div>
                              {sinBase && (
                                <div className="text-[10px] font-bold text-muted-foreground print:hidden">
                                  Sin base histórica PAR
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-muted-foreground print:hidden">
                              {medida.stockActual}
                            </TableCell>
                            <TableCell>
                              <Input
                                aria-label={`Cantidad ${medida.descripcion}`}
                                type="number"
                                min={0}
                                step={1}
                                value={fila.cantidad}
                                onChange={(e) =>
                                  actualizarFila(medida.id, {
                                    cantidad: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                                  })
                                }
                                className="h-7 w-20 text-right font-black font-mono"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                aria-label={`Precio ${medida.descripcion}`}
                                type="number"
                                min={0}
                                step="0.01"
                                value={fila.precio}
                                onChange={(e) =>
                                  actualizarFila(medida.id, {
                                    precio: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="h-7 w-24 text-right font-bold text-emerald-700 font-mono"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              ${subtotalFila.toFixed(2)}
                            </TableCell>
                            <TableCell className="print:hidden">
                              {medida.requiereConfirmacion ? (
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 cursor-pointer">
                                  <Checkbox
                                    checked={fila.confirmada}
                                    onCheckedChange={(checked) =>
                                      actualizarFila(medida.id, { confirmada: checked === true })
                                    }
                                  />{" "}
                                  Confirmar
                                </label>
                              ) : (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Lista
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Panel Lateral: Totales, Ahorro y Acciones de Comunicación */}
            <aside className="space-y-3 lg:pt-1 print:hidden">
              {/* Widget de Ahorro China vs USA */}
              {totales.costoItemsUSD > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-700" /> Ahorro vs USA
                    </span>
                    <span className="rounded bg-emerald-200 px-1.5 py-0.5 font-mono text-[10px] font-black text-emerald-900">
                      -{ahorroBenchmarkUSA.porcentajeAhorro}%
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-emerald-900">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cotizado China:</span>
                      <strong className="font-mono">${ahorroBenchmarkUSA.totalChinaUSD.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ref. USA (McMaster):</span>
                      <span className="font-mono line-through text-muted-foreground">
                        ${ahorroBenchmarkUSA.totalUSAUSD.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200 pt-1 font-bold">
                      <span>Ahorro estimado:</span>
                      <span className="font-mono text-emerald-700">
                        +${ahorroBenchmarkUSA.ahorroUSD.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen de Costos Landed */}
              <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-xs">
                <div className="font-bold text-foreground">Desglose de Costos</div>
                <div>
                  <Label htmlFor="ali-cost" className="text-[11px]">Ali Cost USD</Label>
                  <Input
                    id="ali-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={aliCost}
                    onChange={(e) => setAliCost(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping" className="text-[11px]">Shipping USD (DHL/FedEx)</Label>
                  <Input
                    id="shipping"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    className="h-8 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <Label htmlFor="tipo-cambio" className="text-[11px]">Tipo de cambio USD/MXN</Label>
                  <Input
                    id="tipo-cambio"
                    type="number"
                    min={0}
                    step="0.01"
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                    placeholder="Opcional (ej. 18.50)"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <label className="flex items-start gap-2 text-xs pt-1 cursor-pointer">
                  <Checkbox
                    checked={adicionalesConfirmados}
                    onCheckedChange={(checked) => setAdicionalesConfirmados(checked === true)}
                  />{" "}
                  <span>Costos adicionales confirmados</span>
                </label>

                <div className="border-t border-border pt-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Landed</div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {formatPrecio(totales.totalUSD, "USD")}
                  </div>
                  {totalMXNEstimado !== null && (
                    <div className="text-xs font-semibold text-muted-foreground font-mono">
                      (~{formatPrecio(totalMXNEstimado, "MXN")})
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de Comunicación Multicanal & Exportación */}
              <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Comunicación con Proveedor
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copiarWhatsApp()}
                    className="h-8 text-xs font-semibold gap-1.5 bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copiarWeChat()}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-sky-600" /> WeChat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={abrirCorreo}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5 text-rose-600" /> Email Rita
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={descargarExcelPO}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" /> Excel PO
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copiarTabla()}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5 text-primary" /> Copiar TSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={imprimirPO}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" /> PDF / Imprimir
                  </Button>
                </div>
                {ultimoPedido && (
                  <div className="pt-1 text-[10px] text-muted-foreground text-center">
                    Último pedido registrado: <strong>{ultimoPedido.fecha}</strong> ({formatPrecio(ultimoPedido.totalUSD, "USD")})
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950 cursor-pointer">
                <Checkbox
                  checked={revisionHumana}
                  onCheckedChange={(checked) => setRevisionHumana(checked === true)}
                />
                <span>
                  <strong>Revisión humana:</strong> confirmé cantidades, precios y especificaciones.
                </span>
              </label>

              {mensaje && <p className="text-xs text-emerald-700 font-medium">{mensaje}</p>}
              {error && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
            </aside>
          </div>

          <DialogFooter className="border-t px-5 py-4 print:hidden">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => void registrar()}
              disabled={guardando || !revisionHumana}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
            >
              <ShieldCheck className="h-4 w-4" /> {guardando ? "Registrando..." : "Registrar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Importación Inteligente IA / Excel */}
      {modalImportarAbierto && (
        <ModalImportadorIA
          abierto={modalImportarAbierto}
          onClose={() => setModalImportarAbierto(false)}
          medidas={medidas}
          onAplicarImportados={aplicarImportadosAlPedido}
          onCrearMedida={onCrearMedida}
        />
      )}
    </>
  )
}
