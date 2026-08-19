import { useState } from 'react'
import { useSalidas } from '@/lib/hooks/useAlmacen'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { Plus, Trash2, Search } from 'lucide-react'
import type { SalidaAlmacen } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
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

type SalidaCardProps = {
  s: SalidaAlmacen
  onEliminar: (id: string, desc: string) => void
}

// Tarjeta para < md: mismos datos que la fila de tabla, sin scroll horizontal.
function SalidaCard({ s, onEliminar }: SalidaCardProps) {
  return (
    <div className="p-4 space-y-2.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{s.fecha}</p>
          <p className="text-sm font-semibold text-gray-900 break-words">{s.herramienta}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">x{s.cantidad}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600">
            {s.operador.charAt(0).toUpperCase()}
          </div>
          {s.operador}
        </div>
        <button onClick={() => onEliminar(s.id, s.herramienta)} className="p-1.5 text-gray-400 hover:text-red-500" title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function SalidasList() {
  const confirmar = useConfirmDialog()
  const { salidas, loading: loadingSalidas, error, fetchSalidas, agregarSalida, borrarSalida } = useSalidas()
  const { activos: operadoresActivos, loading: loadingOps } = useOperadores()

  const [busqueda, setBusqueda] = useState('')
  const [agregando, setAgregando] = useState(false)

  // Form state
  const hoy = fechaHoyLocal()
  const [fecha, setFecha] = useState(hoy)
  const [herramienta, setHerramienta] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [operador, setOperador] = useState('')

  const filtradas = salidas.filter((s) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return s.herramienta.toLowerCase().includes(q) || s.operador.toLowerCase().includes(q)
  })

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!herramienta || !operador || cantidad < 1) return

    setAgregando(true)
    try {
      await agregarSalida({
        fecha,
        herramienta,
        cantidad,
        operador,
        cambio: null,
      })
      // Reset only tool and qty, keep date and operator
      setHerramienta('')
      setCantidad(1)
    } catch (err) {
      console.error('Error agregando salida:', err)
    } finally {
      setAgregando(false)
    }
  }

  async function handleEliminar(id: string, desc: string) {
    const aceptado = await confirmar({
      title: 'Eliminar salida de almacén',
      description: `Se eliminará la salida de “${desc}”.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await borrarSalida(id)
    } catch (err) {
      console.error('Error eliminando salida:', err)
    }
  }

  if (loadingSalidas || loadingOps) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchSalidas} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por herramienta u operador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
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
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Herramienta</label>
          <input
            type="text"
            required
            placeholder="Ej. Machuelo 1/4-20"
            value={herramienta}
            onChange={(e) => setHerramienta(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
          <input
            type="number"
            required
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Operador</label>
          <select
            required
            value={operador}
            onChange={(e) => setOperador(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>Seleccionar...</option>
            {operadoresActivos.map(op => (
              <option key={op.id} value={op.nombre}>{op.nombre}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={agregando} size="sm">
          <Plus />
          Registrar Salida
        </Button>
      </form>

      <div className="hidden md:block">
        <ModuleSurface>
          <Table>
            <TableHeader className="bg-muted/50 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 w-28">Fecha</TableHead>
                <TableHead className="px-4 py-3">Herramienta</TableHead>
                <TableHead className="px-4 py-3 w-24">Cantidad</TableHead>
                <TableHead className="px-4 py-3 w-48">Operador</TableHead>
                <TableHead className="px-4 py-3 w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground whitespace-normal">
                    {busqueda ? 'No se encontraron salidas' : 'No hay salidas registradas'}
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="px-4 py-2 text-muted-foreground">{s.fecha}</TableCell>
                    <TableCell className="px-4 py-2 font-medium text-foreground whitespace-normal">{s.herramienta}</TableCell>
                    <TableCell className="px-4 py-2">{s.cantidad}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {s.operador.charAt(0).toUpperCase()}
                        </span>
                        {s.operador}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleEliminar(s.id, s.herramienta)}
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
            {busqueda ? 'No se encontraron salidas' : 'No hay salidas registradas'}
          </div>
        ) : (
          filtradas.map((s) => <SalidaCard key={s.id} s={s} onEliminar={handleEliminar} />)
        )}
      </div>
    </div>
  )
}
