"use client"

import { useMemo, useState } from "react"
import { ClipboardCopy, Download, MessageSquare, Mail, Search, ShieldCheck, Sparkles } from "lucide-react"
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
  calcularCantidadSugerida,
  calcularTotalesPedidoEndmills,
  generarTextoWeChat,
} from "@/lib/endmills-calculos"
import { fechaHoyLocal, formatPrecio } from "@/lib/format"
import type { ItemExtraidoEndmill } from "@/lib/endmills-extraer-ia"
import type { ActorEndmills } from "@/lib/endmills"
import type {
  EndmillMedida,
  PedidoEndmills,
  RegistrarPedidoEndmillsInput,
} from "@/lib/schemas"
import ModalImportadorIA from "@/app/endmills/components/ModalImportadorIA"

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
  onClose,
}: {
  medidas: EndmillMedida[]
  ultimoPedido: PedidoEndmills | null
  actor: ActorEndmills
  onRegistrar: (input: RegistrarPedidoEndmillsInput, actor: ActorEndmills) => Promise<string>
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

  function aplicarImportadosAlPedido(items: ItemExtraidoEndmill[]) {
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
    setMensaje(`Se importaron y aplicaron ${aplicados} partidas al pedido.`)
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
    setMensaje("Tabla copiada al portapapeles.")
  }

  async function copiarWeChat() {
    const texto = generarTextoWeChat(seleccionadas, filas)
    await navigator.clipboard.writeText(texto)
    setMensaje("Texto para WeChat / WhatsApp copiado.")
  }

  function descargarCsv() {
    const blob = new Blob(["\uFEFF" + tablaTexto(",")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = `endmills-${fecha}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  function abrirCorreo() {
    const asunto = encodeURIComponent(`SMV Maquinados · Endmills ${fecha}`)
    const cuerpo = encodeURIComponent(
      `Hello Rita,\n\nPlease quote the following end mills:\n\n${tablaTexto(
        "\t"
      )}\n\nItems total reference: ${formatPrecio(totales.costoItemsUSD, "USD")}`
    )
    window.location.href = `mailto:${PROVEEDOR.email}?subject=${asunto}&body=${cuerpo}`
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
        <DialogContent className="max-h-[94vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle className="text-lg">Revisar pedido de Endmills</DialogTitle>
                <DialogDescription>
                  Las cantidades son editables. Nada se registra hasta confirmar al final.
                </DialogDescription>
              </div>
              <Button
                onClick={() => {
                  setError(null)
                  setModalImportarAbierto(true)
                }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-xs shrink-0"
              >
                <Sparkles className="h-4 w-4 mr-1.5 animate-pulse" /> ✨ Importar Solicitud (IA / Excel)
              </Button>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 pb-5 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0 space-y-3">
              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <div>
                  <Label htmlFor="pedido-fecha">Fecha</Label>
                  <Input
                    id="pedido-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pedido-numero">Folio proveedor</Label>
                  <Input
                    id="pedido-numero"
                    value={numeroProveedor}
                    onChange={(e) => setNumeroProveedor(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-500">Proveedor</span>
                  <div className="font-bold">Rita · ChangZhou</div>
                </div>
              </div>

              {/* Barra de herramientas de vista y búsqueda interna del pedido */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-slate-50 p-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setVistaItems("solicitados")}
                    className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                      vistaItems === "solicitados"
                        ? "bg-sky-700 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Solo Ítems Solicitados ({seleccionadas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaItems("todos")}
                    className={`rounded-md px-3 py-1.5 font-bold transition-colors ${
                      vistaItems === "todos"
                        ? "bg-sky-700 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Ver Todo el Catálogo ({medidas.length})
                  </button>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={busquedaInterna}
                    onChange={(e) => setBusquedaInterna(e.target.value)}
                    placeholder="Filtrar medida o spec..."
                    className="h-8 pl-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead>Medida / spec</TableHead>
                      <TableHead className="w-24 text-right">Stock</TableHead>
                      <TableHead className="w-28 text-right">Cantidad</TableHead>
                      <TableHead className="w-32 text-right">Precio USD</TableHead>
                      <TableHead className="w-24">Confirmación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medidasVisibles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="p-8 text-center text-xs text-slate-500">
                          {vistaItems === "solicitados"
                            ? "No hay partidas con cantidad > 0. Usa el botón '✨ Importar Solicitud (IA / Excel)' o cambia a 'Ver Todo el Catálogo'."
                            : "No se encontraron medidas que coincidan con la búsqueda."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      medidasVisibles.map((medida) => {
                        const fila = filas[medida.id]
                        const sinBase = medida.objetivoPar === null
                        return (
                          <TableRow
                            key={medida.id}
                            className={medida.requiereConfirmacion ? "bg-amber-50" : ""}
                          >
                            <TableCell className="max-w-sm whitespace-normal">
                              <div className="font-semibold">
                                {medida.medidaPulgadas}&quot; · {medida.descripcion}
                              </div>
                              <div className="truncate font-mono text-[10px] text-slate-500">
                                {medida.specPropuesta}
                              </div>
                              {sinBase && (
                                <div className="text-[10px] font-bold text-slate-500">
                                  Definir manualmente · sin base histórica
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold">
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
                                className="text-right font-bold"
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
                                className="text-right font-semibold text-emerald-700"
                              />
                            </TableCell>
                            <TableCell>
                              {medida.requiereConfirmacion ? (
                                <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                                  <Checkbox
                                    checked={fila.confirmada}
                                    onCheckedChange={(checked) =>
                                      actualizarFila(medida.id, { confirmada: checked === true })
                                    }
                                  />{" "}
                                  Confirmado
                                </label>
                              ) : (
                                <span className="text-xs text-emerald-700 font-semibold">Lista</span>
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

            <aside className="space-y-3 lg:pt-1">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Comparación
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>Artículos pedido anterior</span>
                  <strong>
                    {ultimoPedido ? formatPrecio(ultimoPedido.costoItemsUSD, "USD") : "—"}
                  </strong>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span>Artículos actuales</span>
                  <strong>{formatPrecio(totales.costoItemsUSD, "USD")}</strong>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span>Piezas</span>
                  <strong>{totales.numeroPiezas}</strong>
                </div>
              </div>
              <div className="space-y-2 rounded-xl border p-3">
                <div>
                  <Label htmlFor="ali-cost">Ali Cost USD</Label>
                  <Input
                    id="ali-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={aliCost}
                    onChange={(e) => setAliCost(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="shipping">Shipping USD</Label>
                  <Input
                    id="shipping"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tipo-cambio">Tipo de cambio USD/MXN</Label>
                  <Input
                    id="tipo-cambio"
                    type="number"
                    min={0}
                    step="0.01"
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                    placeholder="Opcional (ej. 18.50)"
                  />
                </div>
                <label className="flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={adicionalesConfirmados}
                    onCheckedChange={(checked) => setAdicionalesConfirmados(checked === true)}
                  />{" "}
                  Costos adicionales confirmados
                </label>
                <div className="border-t pt-2">
                  <div className="text-xs text-slate-500">Total landed</div>
                  {adicionalesConfirmados ? (
                    <div>
                      <div className="text-xl font-black text-emerald-700">
                        {formatPrecio(totales.totalUSD, "USD")}
                      </div>
                      {totalMXNEstimado !== null && (
                        <div className="text-xs font-semibold text-slate-600">
                          (~{formatPrecio(totalMXNEstimado, "MXN")})
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs font-semibold text-slate-600">
                      Confirma Ali Cost y shipping para mostrarlo.
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copiarTabla()}
                  title="Copiar tabla"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copiarWeChat()}
                  title="Copiar para WeChat / WhatsApp"
                >
                  <MessageSquare className="h-4 w-4 text-emerald-700" />
                </Button>
                <Button variant="outline" size="sm" onClick={descargarCsv} title="Descargar CSV">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={abrirCorreo} title="Preparar correo">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                <Checkbox
                  checked={revisionHumana}
                  onCheckedChange={(checked) => setRevisionHumana(checked === true)}
                />
                <span>
                  <strong>Revisión humana:</strong> confirmé cantidades, precios y specs.
                </span>
              </label>
              {mensaje && <p className="text-xs text-emerald-700 font-medium">{mensaje}</p>}
              {error && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
            </aside>
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => void registrar()}
              disabled={guardando || !revisionHumana}
              className="bg-sky-700 hover:bg-sky-800 font-bold"
            >
              <ShieldCheck /> {guardando ? "Registrando..." : "Registrar pedido"}
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
        />
      )}
    </>
  )
}
