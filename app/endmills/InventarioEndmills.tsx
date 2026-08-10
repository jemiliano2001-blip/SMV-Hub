"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Edit3, GripVertical, History, Pencil, Plus, RefreshCw, Save, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
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
import { listarHistorialMedidaEndmills, type ConteoEndmillInput } from "@/lib/endmills"
import type {
  CategoriaEndmill,
  CrearEndmillMedidaInput,
  EndmillMedida,
  EstadoStockEndmill,
  PartidaPedidoEndmills,
  ReordenarMedidaItem,
} from "@/lib/schemas"

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
  const [seleccionada, setSeleccionada] = useState<EndmillMedida | null>(null)
  const [stockEditado, setStockEditado] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<{
    medidaId: string
    rows: PartidaPedidoEndmills[]
  } | null>(null)

  // Modo conteo masivo inline. `basesConteo` es la foto del stock con la que se
  // abrió el conteo (sirve para detectar si alguien más lo movió mientras tanto)
  // y `tocados` son las filas que el usuario capturó de verdad: solo esas se
  // guardan, para no revertir cambios ajenos en las que ni siquiera miró.
  const [modoConteo, setModoConteo] = useState(false)
  const [stocksInline, setStocksInline] = useState<Record<string, number>>({})
  const [basesConteo, setBasesConteo] = useState<Record<string, number>>({})
  const [tocados, setTocados] = useState<string[]>([])

  // Estado para crear nuevo endmill
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [creandoMedida, setCreandoMedida] = useState(false)
  const [nuevoCategoria, setNuevoCategoria] = useState<CategoriaEndmill>("FLAT")
  const [nuevoMedidaPulgadas, setNuevoMedidaPulgadas] = useState("")
  const [nuevoDescripcion, setNuevoDescripcion] = useState("")
  const [nuevoSpecPropuesta, setNuevoSpecPropuesta] = useState("")
  const [nuevoStockInicial, setNuevoStockInicial] = useState("0")
  const [nuevoPrecioUSD, setNuevoPrecioUSD] = useState("0")
  const [nuevoObjetivoPar, setNuevoObjetivoPar] = useState("")
  const [nuevoRequiereConfirmacion, setNuevoRequiereConfirmacion] = useState(false)
  const [nuevoNotas, setNuevoNotas] = useState("")

  // Estado para reordenamiento (Grab and Place / Drag and Drop)
  const [ordenLocal, setOrdenLocal] = useState<EndmillMedida[]>([])
  const [reordenModificado, setReordenModificado] = useState(false)
  const [guardandoOrden, setGuardandoOrden] = useState(false)
  const [arrastrandoIndex, setArrastrandoIndex] = useState<number | null>(null)

  // Sincronizar orden local cuando cambia la lista base de Firestore y no hay cambios sin
  // guardar. Se ajusta durante el render (no en un efecto) para evitar un ciclo extra de
  // render en cascada; ver https://react.dev/learn/you-might-not-need-an-effect
  const [medidasPrevias, setMedidasPrevias] = useState(medidas)
  if (medidas !== medidasPrevias && !reordenModificado) {
    setMedidasPrevias(medidas)
    setOrdenLocal(medidas)
  }

  useEffect(() => {
    if (!seleccionada) return
    let cancelado = false
    const medidaId = seleccionada.id
    void listarHistorialMedidaEndmills(medidaId)
      .then((rows) => {
        if (!cancelado) setHistorial({ medidaId, rows })
      })
      .catch((err: unknown) => {
        console.error("No se pudo cargar historial de endmill:", err)
        if (!cancelado) setHistorial({ medidaId, rows: [] })
      })
    return () => {
      cancelado = true
    }
  }, [seleccionada])

  const reordenHabilitado = busqueda.trim() === "" && categoria === "todas" && filtroEstadoExterno === "todas" && !modoConteo

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
    setError(null)
    try {
      const items: ReordenarMedidaItem[] = ordenLocal.map((item, idx) => ({
        id: item.id,
        orden: idx + 1,
      }))
      await onReordenarMedidas(items)
      setReordenModificado(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar el nuevo orden.")
    } finally {
      setGuardandoOrden(false)
    }
  }

  async function guardarCrearMedida() {
    if (!onCrearMedida) return
    if (!nuevoMedidaPulgadas.trim() || !nuevoDescripcion.trim() || !nuevoSpecPropuesta.trim()) {
      setError("Medida en pulgadas, descripción y spec son requeridos.")
      return
    }
    setCreandoMedida(true)
    setError(null)
    try {
      await onCrearMedida({
        categoria: nuevoCategoria,
        medidaPulgadas: nuevoMedidaPulgadas.trim(),
        descripcion: nuevoDescripcion.trim(),
        specPropuesta: nuevoSpecPropuesta.trim(),
        stockInicial: Math.max(0, Math.trunc(Number(nuevoStockInicial) || 0)),
        precioActualUSD: Math.max(0, Number(nuevoPrecioUSD) || 0),
        objetivoPar: nuevoObjetivoPar.trim() ? Math.max(0, Math.trunc(Number(nuevoObjetivoPar))) : null,
        requiereConfirmacion: nuevoRequiereConfirmacion,
        notas: nuevoNotas.trim() || null,
      })
      setModalCrearAbierto(false)
      // Reset form
      setNuevoMedidaPulgadas("")
      setNuevoDescripcion("")
      setNuevoSpecPropuesta("")
      setNuevoStockInicial("0")
      setNuevoPrecioUSD("0")
      setNuevoObjetivoPar("")
      setNuevoRequiereConfirmacion(false)
      setNuevoNotas("")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la nueva medida de endmill.")
    } finally {
      setCreandoMedida(false)
    }
  }

  function iniciarModoConteo() {
    const inicial = Object.fromEntries(medidas.map((m) => [m.id, m.stockActual]))
    setStocksInline(inicial)
    setBasesConteo(inicial)
    setTocados([])
    setModoConteo(true)
    setError(null)
  }

  function capturarStockInline(id: string, valor: number) {
    setStocksInline((actual) => ({ ...actual, [id]: valor }))
    setTocados((actual) => (actual.includes(id) ? actual : [...actual, id]))
  }

  /**
   * Salida del conflicto: vuelve a tomar la foto del stock vivo. Las filas que
   * el usuario no capturó adoptan el valor nuevo (ya no se pisan), y las que sí
   * capturó conservan su conteo físico — que ahora sobrescribe a conciencia.
   */
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
    setError(null)
  }

  async function guardarConteoMasivo() {
    if (!onActualizarStockBatch) return
    setGuardando(true)
    setError(null)
    try {
      // Solo lo que el usuario capturó. Comparar contra el stock vivo mandaría
      // también las filas que otra persona movió mientras contaba y las
      // revertiría; cada fila viaja con el valor que se tenía a la vista para
      // que la transacción aborte si ya cambió.
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
      setError(err instanceof Error ? err.message : "Error guardando conteo masivo.")
    } finally {
      setGuardando(false)
    }
  }

  function abrirDetalle(medida: EndmillMedida) {
    setSeleccionada(medida)
    setStockEditado(String(medida.stockActual))
    setError(null)
  }

  async function guardarStock() {
    if (!seleccionada) return
    const stock = Number(stockEditado)
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Captura un número entero no negativo.")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onActualizarStock(seleccionada.id, stock)
      setSeleccionada(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el stock.")
    } finally {
      setGuardando(false)
    }
  }

  async function resolverConfirmacion() {
    if (!seleccionada || !onConfirmarMedida) return
    setGuardando(true)
    setError(null)
    try {
      await onConfirmarMedida(seleccionada.id)
      setSeleccionada(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.")
    } finally {
      setGuardando(false)
    }
  }

  if (loading && medidas.length === 0) {
    return <div className="space-y-2 rounded-xl border bg-white p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
                onClick={() => {
                  setError(null)
                  setModalCrearAbierto(true)
                }}
                className="bg-sky-700 hover:bg-sky-800 text-white font-semibold shrink-0"
              >
                <Plus className="h-4 w-4" /> Agregar Endmill
              </Button>
            )}
            {onActualizarStockBatch && (
              <div>
                {modoConteo ? (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => void guardarConteoMasivo()} disabled={guardando} className="bg-emerald-700 hover:bg-emerald-800">
                      <Save className="h-4 w-4" />{" "}
                      {guardando
                        ? "Guardando..."
                        : `Guardar conteo${tocados.length > 0 ? ` (${tocados.length})` : ""}`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setModoConteo(false)} disabled={guardando}>
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={iniciarModoConteo} className="text-slate-700">
                    <Edit3 className="h-4 w-4" /> Conteo rápido inline
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((item) => {
            const cantidad = item.id === "todas"
              ? medidas.length
              : medidas.filter((medida) => medida.categoria === item.id).length
            return (
              <button
                key={item.id}
                onClick={() => setCategoria(item.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  categoria === item.id
                    ? "border-sky-700 bg-sky-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
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
          <span className="font-semibold">Has modificado el orden de los endmills. Haz clic en guardar para conservar la posición.</span>
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
              }}
              disabled={guardandoOrden}
              className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
            >
              Restablecer
            </Button>
          </div>
        </div>
      )}

      {modoConteo && error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={refrescarBaseConteo}
            disabled={guardando}
            className="shrink-0 border-rose-300 bg-white text-rose-900 hover:bg-rose-100"
          >
            <RefreshCw className="h-4 w-4" /> Usar mi conteo de todas formas
          </Button>
        </div>
      )}

      {filtroEstadoExterno !== "todas" && (
        <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
          <span>Filtrando por estado: <strong>{ETIQUETA_ESTADO[filtroEstadoExterno]}</strong></span>
          <span className="font-semibold text-sky-700">
            {listaAMostrar.length === 1 ? "1 medida encontrada" : `${listaAMostrar.length} medidas encontradas`}
          </span>
        </div>
      )}

      {medidas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
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
              <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaAMostrar.map((medida, index) => {
              const stockMostrar = modoConteo ? (stocksInline[medida.id] ?? medida.stockActual) : medida.stockActual
              const estado = clasificarStockEndmill(stockMostrar, medida.objetivoPar)
              const sugerido = calcularCantidadSugerida(medida.objetivoPar, stockMostrar)
              const esArrastrado = arrastrandoIndex === index
              return (
                <TableRow
                  key={medida.id}
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
                  className={`${medida.requiereConfirmacion ? "bg-amber-50/70" : ""} ${
                    esArrastrado ? "opacity-40 bg-sky-100" : ""
                  }`}
                >
                  {reordenHabilitado && (
                    <TableCell className="w-16 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <GripVertical className="h-4 w-4 cursor-grab text-slate-400 hover:text-slate-700 active:cursor-grabbing" aria-label="Arrastra para mover de posición (Grab & Place)" />
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moverPosicion(index, index - 1)}
                            className="text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Mover arriba"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === listaAMostrar.length - 1}
                            onClick={() => moverPosicion(index, index + 1)}
                            className="text-slate-400 hover:text-slate-800 disabled:opacity-20"
                            title="Mover abajo"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="font-mono font-bold text-slate-900">{medida.medidaPulgadas}&quot;</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      {medida.requiereConfirmacion && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      {medida.descripcion}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{medida.specPropuesta}</div>
                  </TableCell>
                  <TableCell className="text-right text-base font-black tabular-nums">
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
                  <TableCell><EstadoBadge estado={estado} /></TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">{formatPrecio(medida.precioActualUSD, "USD")}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{sugerido === null ? "—" : sugerido}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => abrirDetalle(medida)} aria-label={`Editar ${medida.descripcion}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {seleccionada && (
        <Dialog open onOpenChange={(open) => !open && setSeleccionada(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{seleccionada.descripcion}</span>
                {seleccionada.requiereConfirmacion && onConfirmarMedida && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resolverConfirmacion()}
                    disabled={guardando}
                    className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Marcar confirmada
                  </Button>
                )}
              </DialogTitle>
              <DialogDescription>{seleccionada.specPropuesta}</DialogDescription>
            </DialogHeader>
            {seleccionada.requiereConfirmacion && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Precio o especificación pendientes de confirmar con China. Esta partida no entra automáticamente en un pedido.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock-endmill">Stock actual</Label>
                <Input id="stock-endmill" type="number" min={0} step={1} value={stockEditado} onChange={(event) => setStockEditado(event.target.value)} />
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-xs text-slate-500">Precio vigente</div>
                <div className="font-bold text-emerald-700">{formatPrecio(seleccionada.precioActualUSD, "USD")}</div>
                <div className="mt-2 text-xs text-slate-500">Objetivo base</div>
                <div className="font-bold">{seleccionada.objetivoPar ?? "Sin base"}</div>
              </div>
            </div>
            {seleccionada.notas && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{seleccionada.notas}</p>}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Historial de compras y variación de precios</div>
              {historial?.medidaId !== seleccionada.id ? (
                <Skeleton className="h-16 w-full" />
              ) : historial.rows.length === 0 ? (
                <p className="text-xs text-slate-500">Sin pedidos rastreados para esta medida.</p>
              ) : (
                <div className="space-y-1">
                  {historial.rows.map((linea, index) => {
                    const anterior = historial.rows[index + 1]
                    let pctVar: string | null = null
                    if (anterior && anterior.precioUnitarioUSD > 0) {
                      const diff = ((linea.precioUnitarioUSD - anterior.precioUnitarioUSD) / anterior.precioUnitarioUSD) * 100
                      pctVar = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`
                    }
                    return (
                      <div key={linea.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                        <span>{linea.fechaPedido} · {linea.cantidadPedida} pzas</span>
                        <div className="flex items-center gap-2 font-semibold">
                          {pctVar && (
                            <span className={`text-[10px] font-bold ${pctVar.startsWith("+") ? "text-rose-600" : "text-emerald-600"}`}>
                              ({pctVar})
                            </span>
                          )}
                          <span>{formatPrecio(linea.precioUnitarioUSD, "USD")} c/u</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSeleccionada(null)}>Cerrar</Button>
              <Button onClick={() => void guardarStock()} disabled={guardando}>{guardando ? "Guardando..." : "Guardar stock"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {modalCrearAbierto && (
        <Dialog open onOpenChange={(open) => !open && setModalCrearAbierto(false)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-sky-700" /> Agregar Nuevo Endmill al Catálogo
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
                  value={nuevoCategoria}
                  onChange={(e) => setNuevoCategoria(e.target.value as CategoriaEndmill)}
                  className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm font-medium focus:border-sky-500 focus:outline-hidden"
                >
                  {CATEGORIAS.filter((c) => c.id !== "todas").map((c) => (
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
                  value={nuevoMedidaPulgadas}
                  onChange={(e) => setNuevoMedidaPulgadas(e.target.value)}
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
                  value={nuevoPrecioUSD}
                  onChange={(e) => setNuevoPrecioUSD(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nuevo-descripcion">Descripción Comercial *</Label>
                <Input
                  id="nuevo-descripcion"
                  placeholder="e.g. FLAT 4 FILOS 1/4"
                  value={nuevoDescripcion}
                  onChange={(e) => setNuevoDescripcion(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nuevo-spec">Especificación Técnica (Spec) *</Label>
                <Input
                  id="nuevo-spec"
                  placeholder="e.g. D1/4*FL3/4*L50*4F"
                  value={nuevoSpecPropuesta}
                  onChange={(e) => setNuevoSpecPropuesta(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nuevo-stock">Stock Inicial (pzas)</Label>
                <Input
                  id="nuevo-stock"
                  type="number"
                  min={0}
                  step={1}
                  value={nuevoStockInicial}
                  onChange={(e) => setNuevoStockInicial(e.target.value)}
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
                  value={nuevoObjetivoPar}
                  onChange={(e) => setNuevoObjetivoPar(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                <input
                  type="checkbox"
                  id="nuevo-confirmacion"
                  checked={nuevoRequiereConfirmacion}
                  onChange={(e) => setNuevoRequiereConfirmacion(e.target.checked)}
                  className="h-4 w-4 rounded-xs border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <Label htmlFor="nuevo-confirmacion" className="cursor-pointer text-xs font-semibold text-slate-700">
                  Marcar como pendiente de confirmación (precio/spec con China)
                </Label>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nuevo-notas">Notas Adicionales (Opcional)</Label>
                <Input
                  id="nuevo-notas"
                  placeholder="e.g. Proveedor especial, recubrimiento TiAlN..."
                  value={nuevoNotas}
                  onChange={(e) => setNuevoNotas(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-700">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalCrearAbierto(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void guardarCrearMedida()}
                disabled={creandoMedida}
                className="bg-sky-700 hover:bg-sky-800 text-white font-semibold"
              >
                {creandoMedida ? "Guardando..." : "Agregar Endmill"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

function EstadoBadge({ estado }: { estado: EstadoStockEndmill }) {
  const className = {
    sin_base: "border-slate-200 bg-slate-100 text-slate-700",
    critico: "border-rose-200 bg-rose-50 text-rose-700",
    bajo: "border-amber-200 bg-amber-50 text-amber-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[estado]
  return <Badge variant="outline" className={className}>{ETIQUETA_ESTADO[estado]}</Badge>
}

