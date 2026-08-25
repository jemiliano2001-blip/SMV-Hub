"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Edit3,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
  Copy,
  Eye,
  PlusCircle,
  MinusCircle,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { copiarAlPortapapeles } from "@/lib/portapapeles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
  clasificarStockEndmill,
} from "@/lib/endmills-calculos"
import { formatPrecio } from "@/lib/format"
import type { ConteoEndmillInput } from "@/lib/endmills"
import type {
  CategoriaEndmill,
  CrearEndmillMedidaInput,
  EndmillMedida,
  EstadoStockEndmill,
  ReordenarMedidaItem,
} from "@/lib/schemas"
import ModuleSurface from "@/components/layout/ModuleSurface"
import ModalCrearEndmill from "@/app/endmills/components/ModalCrearEndmill"
import ModalDetalleEndmill from "@/app/endmills/components/ModalDetalleEndmill"

/** Etiquetas legibles de los estados; el slug crudo nunca se muestra en pantalla. */
const ETIQUETA_ESTADO: Record<EstadoStockEndmill | "confirmar", string> = {
  sin_base: "Sin base",
  critico: "Crítico",
  bajo: "Bajo",
  ok: "OK",
  confirmar: "Por confirmar",
}

const CATEGORIAS: Array<{ id: CategoriaEndmill | "todas"; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "FLAT", label: "Flat" },
  { id: "BALL", label: "Ball" },
  { id: "LARGO_FLAT", label: "Largo Flat" },
  { id: "LARGO_BOLA", label: "Largo Bola" },
  { id: "EXTRA_LARGO_FLAT", label: "Extra Largo Flat" },
  { id: "EXTRA_LARGO_BOLA", label: "Extra Largo Bola" },
  { id: "RUPA_CARBURO", label: "Rupa / Carburo" },
]

export default function InventarioEndmills({
  medidas,
  loading,
  filtroEstadoExterno = "todas",
  onActualizarStock,
  onActualizarStockBatch,
  onConfirmarMedida,
  onCrearMedida,
  onReordenarMedidas,
}: {
  medidas: EndmillMedida[]
  loading: boolean
  filtroEstadoExterno?: EstadoStockEndmill | "todas" | "confirmar"
  onActualizarStock: (id: string, stock: number) => Promise<void>
  onActualizarStockBatch?: (items: readonly ConteoEndmillInput[]) => Promise<void>
  onConfirmarMedida?: (id: string) => Promise<void>
  onCrearMedida?: (input: CrearEndmillMedidaInput) => Promise<string>
  onReordenarMedidas?: (items: readonly ReordenarMedidaItem[]) => Promise<void>
}) {
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState<CategoriaEndmill | "todas">("todas")
  const [medidaSeleccionada, setMedidaSeleccionada] = useState<EndmillMedida | null>(null)
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)

  // Modo conteo masivo inline
  const [modoConteo, setModoConteo] = useState(false)
  const [stocksInline, setStocksInline] = useState<Record<string, number>>({})
  const [basesConteo, setBasesConteo] = useState<Record<string, number>>({})
  const [tocados, setTocados] = useState<string[]>([])
  const [guardandoConteo, setGuardandoConteo] = useState(false)
  const [errorConteo, setErrorConteo] = useState<string | null>(null)

  // Estado para reordenamiento (Grab and Place / Drag and Drop)
  const [ordenLocal, setOrdenLocal] = useState<EndmillMedida[]>([])
  const [reordenModificado, setReordenModificado] = useState(false)
  const [guardandoOrden, setGuardandoOrden] = useState(false)
  const [errorOrden, setErrorOrden] = useState<string | null>(null)
  const [arrastrandoIndex, setArrastrandoIndex] = useState<number | null>(null)

  // Sincronizar orden local cuando cambia la lista base de Firestore y no hay cambios sin guardar
  const [medidasPrevias, setMedidasPrevias] = useState(medidas)
  if (medidas !== medidasPrevias && !reordenModificado) {
    setMedidasPrevias(medidas)
    setOrdenLocal(medidas)
  }

  const reordenHabilitado =
    busqueda.trim() === "" &&
    categoria === "todas" &&
    filtroEstadoExterno === "todas" &&
    !modoConteo

  const listaAMostrar = useMemo(() => {
    if (reordenHabilitado && ordenLocal.length > 0) {
      return ordenLocal
    }
    const q = busqueda.trim().toLowerCase()
    return medidas.filter((medida) => {
      if (categoria !== "todas" && medida.categoria !== categoria) return false
      if (filtroEstadoExterno !== "todas") {
        if (filtroEstadoExterno === "confirmar") {
          if (!medida.requiereConfirmacion) return false
        } else {
          const st = clasificarStockEndmill(medida.stockActual, medida.objetivoPar)
          if (st !== filtroEstadoExterno) return false
        }
      }
      if (!q) return true
      return [medida.descripcion, medida.medidaPulgadas, medida.specPropuesta]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [medidas, ordenLocal, reordenHabilitado, busqueda, categoria, filtroEstadoExterno])

  function moverPosicion(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= ordenLocal.length) return
    const copia = [...ordenLocal]
    const [movido] = copia.splice(fromIndex, 1)
    copia.splice(toIndex, 0, movido)
    setOrdenLocal(copia)
    setReordenModificado(true)
  }

  async function guardarNuevoOrden() {
    if (!onReordenarMedidas || !reordenModificado) return
    setGuardandoOrden(true)
    setErrorOrden(null)
    try {
      const items: ReordenarMedidaItem[] = ordenLocal.map((item, idx) => ({
        id: item.id,
        orden: idx + 1,
      }))
      await onReordenarMedidas(items)
      setReordenModificado(false)
    } catch (err: unknown) {
      setErrorOrden(err instanceof Error ? err.message : "Error al guardar el nuevo orden.")
    } finally {
      setGuardandoOrden(false)
    }
  }

  function iniciarModoConteo() {
    const inicial = Object.fromEntries(medidas.map((m) => [m.id, m.stockActual]))
    setStocksInline(inicial)
    setBasesConteo(inicial)
    setTocados([])
    setModoConteo(true)
    setErrorConteo(null)
  }

  function capturarStockInline(id: string, valor: number) {
    setStocksInline((actual) => ({ ...actual, [id]: valor }))
    setTocados((actual) => (actual.includes(id) ? actual : [...actual, id]))
  }

  function refrescarBaseConteo() {
    const vivo = Object.fromEntries(medidas.map((m) => [m.id, m.stockActual]))
    setBasesConteo(vivo)
    setStocksInline((actual) => {
      const siguiente: Record<string, number> = { ...vivo }
      for (const id of tocados) {
        if (actual[id] !== undefined) siguiente[id] = actual[id]
      }
      return siguiente
    })
    setErrorConteo(null)
  }

  async function guardarConteoMasivo() {
    if (!onActualizarStockBatch) return
    setGuardandoConteo(true)
    setErrorConteo(null)
    try {
      const capturados: ConteoEndmillInput[] = tocados
        .filter((id) => basesConteo[id] !== undefined && stocksInline[id] !== undefined)
        .map((id) => ({
          id,
          stockActual: stocksInline[id],
          stockEsperado: basesConteo[id],
        }))

      if (capturados.length > 0) {
        await onActualizarStockBatch(capturados)
      }
      setModoConteo(false)
    } catch (err: unknown) {
      setErrorConteo(err instanceof Error ? err.message : "Error guardando conteo masivo.")
    } finally {
      setGuardandoConteo(false)
    }
  }

  if (loading && medidas.length === 0) {
    return (
      <ModuleSurface className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </ModuleSurface>
    )
  }

  return (
    <ModuleSurface className="space-y-3 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar medida, descripción o spec..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            {onCrearMedida && (
              <Button
                size="sm"
                onClick={() => setModalCrearAbierto(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shrink-0"
              >
                <Plus className="h-4 w-4" /> Agregar Endmill
              </Button>
            )}
            {onActualizarStockBatch && (
              <div>
                {modoConteo ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => void guardarConteoMasivo()}
                      disabled={guardandoConteo}
                      className="bg-emerald-700 hover:bg-emerald-800"
                    >
                      <Save className="h-4 w-4" />{" "}
                      {guardandoConteo
                        ? "Guardando..."
                        : `Guardar conteo${tocados.length > 0 ? ` (${tocados.length})` : ""}`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModoConteo(false)}
                      disabled={guardandoConteo}
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={iniciarModoConteo}
                    className="text-foreground"
                  >
                    <Edit3 className="h-4 w-4" /> Conteo rápido inline
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((item) => {
            const cantidad =
              item.id === "todas"
                ? medidas.length
                : medidas.filter((medida) => medida.categoria === item.id).length
            return (
              <button
                key={item.id}
                onClick={() => setCategoria(item.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  categoria === item.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {item.label} · {cantidad}
              </button>
            )
          })}
        </div>
      </div>

      {reordenModificado && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">
            Has modificado el orden de los endmills. Haz clic en guardar para conservar la posición.
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void guardarNuevoOrden()}
              disabled={guardandoOrden}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              <Save className="h-4 w-4" /> {guardandoOrden ? "Guardando..." : "Guardar nuevo orden"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOrdenLocal(medidas)
                setReordenModificado(false)
                setErrorOrden(null)
              }}
              disabled={guardandoOrden}
              className="border-emerald-300 bg-card text-emerald-900 hover:bg-emerald-50"
            >
              Restablecer
            </Button>
          </div>
        </div>
      )}

      {errorOrden && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
          {errorOrden}
        </div>
      )}

      {modoConteo && errorConteo && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{errorConteo}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={refrescarBaseConteo}
            disabled={guardandoConteo}
            className="shrink-0 border-rose-300 bg-card text-rose-900 hover:bg-rose-100"
          >
            <RefreshCw className="h-4 w-4" /> Usar mi conteo de todas formas
          </Button>
        </div>
      )}

      {filtroEstadoExterno !== "todas" && (
        <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
          <span>
            Filtrando por estado: <strong>{ETIQUETA_ESTADO[filtroEstadoExterno]}</strong>
          </span>
          <span className="font-semibold text-primary">
            {listaAMostrar.length === 1 ? "1 medida encontrada" : `${listaAMostrar.length} medidas encontradas`}
          </span>
        </div>
      )}

      {medidas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay endmills registrados en el catálogo. Usa el botón &quot;Agregar Endmill&quot; para registrar la primera medida.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {reordenHabilitado && <TableHead className="w-16 text-center">Posición</TableHead>}
              <TableHead>Medida</TableHead>
              <TableHead>Descripción / spec</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaAMostrar.map((medida, index) => {
              const stockMostrar = modoConteo
                ? (stocksInline[medida.id] ?? medida.stockActual)
                : medida.stockActual
              const estado = clasificarStockEndmill(stockMostrar, medida.objetivoPar)
              const sugerido = calcularCantidadSugerida(medida.objetivoPar, stockMostrar)
              const esArrastrado = arrastrandoIndex === index
              return (
                <ContextMenu key={medida.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      draggable={reordenHabilitado}
                      onDragStart={() => setArrastrandoIndex(index)}
                      onDragOver={(e) => {
                        if (!reordenHabilitado) return
                        e.preventDefault()
                      }}
                      onDrop={() => {
                        if (!reordenHabilitado || arrastrandoIndex === null || arrastrandoIndex === index) return
                        moverPosicion(arrastrandoIndex, index)
                        setArrastrandoIndex(null)
                      }}
                      onDoubleClick={() => setMedidaSeleccionada(medida)}
                      className={`cursor-pointer select-none ${medida.requiereConfirmacion ? "bg-amber-50/70" : ""} ${
                        esArrastrado ? "opacity-40 bg-sky-100" : ""
                      }`}
                    >
                      {reordenHabilitado && (
                        <TableCell className="w-16 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <GripVertical
                              className="h-4 w-4 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                              aria-label="Arrastra para mover de posición (Grab & Place)"
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moverPosicion(index, index - 1)}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                                title="Mover arriba"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === listaAMostrar.length - 1}
                                onClick={() => moverPosicion(index, index + 1)}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                                title="Mover abajo"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-mono font-bold text-foreground">
                        {medida.medidaPulgadas}&quot;
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          {medida.requiereConfirmacion && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                          {medida.descripcion}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          {medida.specPropuesta}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-base font-black tabular-nums" onClick={(e) => e.stopPropagation()}>
                        {modoConteo ? (
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={stocksInline[medida.id] ?? medida.stockActual}
                            onChange={(e) => {
                              const v = Math.max(0, Math.trunc(Number(e.target.value) || 0))
                              capturarStockInline(medida.id, v)
                            }}
                            aria-label={`Conteo de ${medida.descripcion}`}
                            className={`ml-auto w-20 text-right font-bold ${
                              tocados.includes(medida.id) ? "border-sky-500 bg-sky-50" : ""
                            }`}
                          />
                        ) : (
                          medida.stockActual
                        )}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={estado} />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">
                        {formatPrecio(medida.precioActualUSD, "USD")}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {sugerido === null ? "—" : sugerido}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMedidaSeleccionada(medida)}
                          aria-label={`Editar ${medida.descripcion}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => setMedidaSeleccionada(medida)}>
                      <Eye className="text-primary" />
                      <span>Ver detalle / Ajustar stock</span>
                      <ContextMenuShortcut>↵</ContextMenuShortcut>
                    </ContextMenuItem>

                    <ContextMenuSeparator />

                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Package className="text-emerald-600" />
                        <span>Ajuste rápido de stock</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-44">
                        <ContextMenuItem
                          onClick={async () => {
                            await onActualizarStock(medida.id, medida.stockActual + 1)
                            toast.success(`Stock de ${medida.medidaPulgadas}" aumentado a ${medida.stockActual + 1}`)
                          }}
                        >
                          <PlusCircle className="text-emerald-600" />
                          <span>+1 pieza ({medida.stockActual + 1})</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={async () => {
                            await onActualizarStock(medida.id, medida.stockActual + 5)
                            toast.success(`Stock de ${medida.medidaPulgadas}" aumentado a ${medida.stockActual + 5}`)
                          }}
                        >
                          <PlusCircle className="text-emerald-600" />
                          <span>+5 piezas ({medida.stockActual + 5})</span>
                        </ContextMenuItem>
                        {medida.stockActual > 0 && (
                          <ContextMenuItem
                            onClick={async () => {
                              await onActualizarStock(medida.id, Math.max(0, medida.stockActual - 1))
                              toast.success(`Stock de ${medida.medidaPulgadas}" reducido a ${Math.max(0, medida.stockActual - 1)}`)
                            }}
                          >
                            <MinusCircle className="text-amber-600" />
                            <span>-1 pieza ({Math.max(0, medida.stockActual - 1)})</span>
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-rose-600"
                          onClick={async () => {
                            await onActualizarStock(medida.id, 0)
                            toast.success(`Stock de ${medida.medidaPulgadas}" marcado en 0 (Agotado)`)
                          }}
                        >
                          <AlertTriangle className="text-rose-600" />
                          <span>Marcar agotado (0)</span>
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>

                    <ContextMenuSeparator />

                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Copy className="text-muted-foreground" />
                        <span>Copiar información</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-48">
                        <ContextMenuItem
                          onClick={() => {
                            void copiarAlPortapapeles(`${medida.medidaPulgadas}"`, 'Medida copiada')
                          }}
                        >
                          <span>Medida ({medida.medidaPulgadas}&quot;)</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            void copiarAlPortapapeles(medida.descripcion, 'Descripción copiada')
                          }}
                        >
                          <span>Descripción</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            void copiarAlPortapapeles(medida.specPropuesta, 'Spec propuesta copiada')
                          }}
                        >
                          <span>Especificación</span>
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* Modal para ver y editar detalle/stock de una medida */}
      {medidaSeleccionada && (
        <ModalDetalleEndmill
          key={medidaSeleccionada.id}
          medida={medidaSeleccionada}
          onClose={() => setMedidaSeleccionada(null)}
          onActualizarStock={onActualizarStock}
          onConfirmarMedida={onConfirmarMedida}
        />
      )}

      {/* Modal para crear una nueva medida */}
      {modalCrearAbierto && onCrearMedida && (
        <ModalCrearEndmill
          abierto={modalCrearAbierto}
          onClose={() => setModalCrearAbierto(false)}
          onCrearMedida={onCrearMedida}
        />
      )}
    </ModuleSurface>
  )
}

function EstadoBadge({ estado }: { estado: EstadoStockEndmill }) {
  const className = {
    sin_base: "border-border bg-muted text-muted-foreground",
    critico: "border-rose-200 bg-rose-50 text-rose-700",
    bajo: "border-amber-200 bg-amber-50 text-amber-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[estado]
  return <Badge variant="outline" className={className}>{ETIQUETA_ESTADO[estado]}</Badge>
}
