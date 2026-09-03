'use client'

import { useState } from 'react'
import { Bookmark, Plus, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useSavedViews } from '@/lib/hooks/useSavedViews'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface SavedViewsDropdownProps<T> {
  modulo: string
  filtrosActuales: T
  onAplicarVista: (filtros: T) => void
  className?: string
}

/**
 * Menú desplegable para seleccionar o guardar vistas de filtros personalizadas.
 */
export default function SavedViewsDropdown<T>({
  modulo,
  filtrosActuales,
  onAplicarVista,
  className,
}: SavedViewsDropdownProps<T>) {
  const { vistas, guardarVista, eliminarVista } = useSavedViews<T>(modulo)
  const [guardando, setGuardando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreNueva.trim()) return

    guardarVista(nombreNueva.trim(), filtrosActuales)
    toast.success(`Vista "${nombreNueva.trim()}" guardada`)
    setNombreNueva('')
    setGuardando(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg border-border cursor-pointer',
            className
          )}
          title="Vistas y filtros guardados"
        >
          <Bookmark className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Vistas</span>
          {vistas.length > 0 && (
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded-full">
              {vistas.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 border-border bg-card p-1.5 shadow-xl">
        <div className="px-2 py-1.5 text-xs font-bold text-foreground flex items-center justify-between">
          <span>Vistas Guardadas</span>
          <span className="text-[10px] font-normal text-muted-foreground">Local</span>
        </div>

        <DropdownMenuSeparator />

        {vistas.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No tienes vistas guardadas en este módulo.
          </div>
        ) : (
          vistas.map((vista) => (
            <div
              key={vista.id}
              className="flex items-center justify-between group rounded-md hover:bg-muted px-2 py-1.5 transition-colors cursor-pointer"
              onClick={() => {
                onAplicarVista(vista.filtros)
                toast.success(`Filtros de "${vista.nombre}" aplicados`)
              }}
            >
              <span className="text-xs font-medium text-foreground truncate max-w-[170px]">
                {vista.nombre}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  eliminarVista(vista.id)
                  toast.success(`Vista "${vista.nombre}" eliminada`)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-600 rounded transition-opacity"
                title="Eliminar vista guardada"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))
        )}

        <DropdownMenuSeparator />

        {guardando ? (
          <form onSubmit={handleGuardar} className="p-1 space-y-1.5">
            <input
              type="text"
              autoFocus
              placeholder="Nombre de la vista..."
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              className="w-full text-xs px-2 py-1 rounded border border-input bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGuardando(false)}
                className="h-6 text-[11px] px-2"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-6 text-[11px] px-2 bg-primary text-primary-foreground"
              >
                Guardar
              </Button>
            </div>
          </form>
        ) : (
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              setGuardando(true)
            }}
            className="text-xs text-primary font-medium gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Guardar filtros actuales como vista</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
