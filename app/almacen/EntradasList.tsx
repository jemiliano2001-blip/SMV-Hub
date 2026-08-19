import { useState } from 'react'
import { useEntradas } from '@/lib/hooks/useAlmacen'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { EntradaAlmacen } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
import { Plus, Trash2, Search } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type EstatusEntrada = EntradaAlmacen['estatus']

const ESTATUS_NEXT: Record<EstatusEntrada, EstatusEntrada> = {
  pendiente: 'entregado',
  entregado: 'devuelto',
  devuelto: 'pendiente',
}

const ESTATUS_BADGE: Record<EstatusEntrada, string> = {
  pendiente: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
  entregado: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  devuelto: 'bg-red-50 text-red-700 ring-red-600/20',
}

type EntradaCardProps = {
  e: EntradaAlmacen
  onCycleEstatus: (id: string, actual: EstatusEntrada) => void
  onEliminar: (id: string, desc: string) => void
}

// Tarjeta para < md: mismos datos que la fila de tabla, sin scroll horizontal.
function EntradaCard({ e, onCycleEstatus, onEliminar }: EntradaCardProps) {
  return (
    <div className="p-4 space-y-2.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{e.fecha}</p>
          <p className="text-sm font-semibold text-gray-900 break-words">{e.descripcion}</p>
        </div>
        <button
          onClick={() => onCycleEstatus(e.id, e.estatus)}
          title="Click para cambiar estatus"
          className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset hover:opacity-75 transition-opacity ${ESTATUS_BADGE[e.estatus]}`}
        >
          {e.estatus}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0">
          <span className="text-gray-400 block">Cantidad</span>
          <span className="text-gray-900 block">{e.cantidad}</span>
        </div>
        <div className="min-w-0">
          <span className="text-gray-400 block">Cargo a</span>
          <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${e.cargoA.toLowerCase() === 'stock' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
            {e.cargoA}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-gray-400 block">Recibió</span>
          <span className="text-gray-900 truncate block">{e.recibio}</span>
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t border-gray-50">
        <button onClick={() => onEliminar(e.id, e.descripcion)} className="p-1.5 text-gray-400 hover:text-red-500" title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function EntradasList() {
  const confirmar = useConfirmDialog()
  const { entradas, loading, error, fetchEntradas, agregarEntrada, editarEntrada, borrarEntrada } = useEntradas()

  const [busqueda, setBusqueda] = useState('')
  const [agregando, setAgregando] = useState(false)

  // Form state
  const hoy = fechaHoyLocal()
  const [fecha, setFecha] = useState(hoy)
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [cargoA, setCargoA] = useState('Stock')
  const [recibio, setRecibio] = useState('')
  const [estatus, setEstatus] = useState<EstatusEntrada>('entregado')
  const { activos: operadoresActivos } = useOperadores()

  const filtradas = entradas.filter((e) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return e.descripcion.toLowerCase().includes(q) || e.cargoA.toLowerCase().includes(q)
  })

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!descripcion || !cantidad || !recibio) return

    setAgregando(true)
    try {
      await agregarEntrada({
        fecha,
        descripcion,
        cantidad,
        cargoA,
        recibio,
        revision: null,
        estatus,
        notas: null,
      })
      // Reset main fields but keep date, cargoA and recibio for faster consecutive entry
      setDescripcion('')
      setCantidad('')
    } catch (err) {
      console.error('Error agregando entrada:', err)
    } finally {
      setAgregando(false)
    }
  }

  async function handleEliminar(id: string, desc: string) {
    const aceptado = await confirmar({
      title: 'Eliminar entrada de almacén',
      description: `Se eliminará la entrada de “${desc}”.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await borrarEntrada(id)
    } catch (err) {
      console.error('Error eliminando entrada:', err)
    }
  }

  async function handleCycleEstatus(id: string, actual: EstatusEntrada) {
    try {
      await editarEntrada(id, { estatus: ESTATUS_NEXT[actual] })
    } catch (err) {
      console.error('Error cambiando estatus:', err)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchEntradas} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción o cargo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-input py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAgregar} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
          <input
            type="text"
            required
            placeholder="Ej. Broca de centro #3"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
          <input
            type="text"
            required
            placeholder="Ej. 15 pza"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cargo a</label>
          <input
            type="text"
            required
            value={cargoA}
            onChange={(e) => setCargoA(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Recibió</label>
          <select
            required
            value={recibio}
            onChange={(e) => setRecibio(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-primary"
          >
            <option value="" disabled>Seleccionar...</option>
            {operadoresActivos.map((op) => (
              <option key={op.id} value={op.nombre}>{op.nombre}</option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Estatus</label>
          <select
            value={estatus}
            onChange={(e) => setEstatus(e.target.value as EstatusEntrada)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-primary"
          >
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="devuelto">Devuelto</option>
          </select>
        </div>
        <Button type="submit" disabled={agregando} size="sm">
          <Plus />
          Registrar
        </Button>
      </form>

      {/* Table (desktop) */}
      <div className="hidden md:block">
        <ModuleSurface>
          <Table>
            <TableHeader className="bg-muted/50 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 w-28">Fecha</TableHead>
                <TableHead className="px-4 py-3">Descripción</TableHead>
                <TableHead className="px-4 py-3 w-24">Cantidad</TableHead>
                <TableHead className="px-4 py-3 w-32">Cargo a</TableHead>
                <TableHead className="px-4 py-3 w-32">Recibió</TableHead>
                <TableHead className="px-4 py-3 w-28 text-center">Estatus</TableHead>
                <TableHead className="px-4 py-3 w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground whitespace-normal">
                    {busqueda ? 'No se encontraron entradas' : 'No hay entradas registradas'}
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="px-4 py-2 text-muted-foreground">{e.fecha}</TableCell>
                    <TableCell className="px-4 py-2 font-medium text-foreground whitespace-normal">{e.descripcion}</TableCell>
                    <TableCell className="px-4 py-2">{e.cantidad}</TableCell>
                    <TableCell className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.cargoA.toLowerCase() === 'stock' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {e.cargoA}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">{e.recibio}</TableCell>
                    <TableCell className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleCycleEstatus(e.id, e.estatus)}
                        title="Click para cambiar estatus"
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset cursor-pointer hover:opacity-75 transition-opacity ${ESTATUS_BADGE[e.estatus]}`}
                      >
                        {e.estatus}
                      </button>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleEliminar(e.id, e.descripcion)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleSurface>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtradas.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {busqueda ? 'No se encontraron entradas' : 'No hay entradas registradas'}
          </div>
        ) : (
          filtradas.map((e) => (
            <EntradaCard key={e.id} e={e} onCycleEstatus={handleCycleEstatus} onEliminar={handleEliminar} />
          ))
        )}
      </div>
    </div>
  )
}
