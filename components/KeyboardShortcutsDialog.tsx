'use client'

import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useGlobalShortcuts } from '@/lib/hooks/useGlobalShortcuts'

interface AtajoItem {
  teclas: string[]
  descripcion: string
}

interface GrupoAtajos {
  titulo: string
  atajos: AtajoItem[]
}

const GRUPOS_ATAJOS: GrupoAtajos[] = [
  {
    titulo: 'Navegación General',
    atajos: [
      { teclas: ['Ctrl', 'K'], descripcion: 'Abrir buscador global y catálogo semántico' },
      { teclas: ['?'], descripcion: 'Abrir este centro de atajos de teclado' },
      { teclas: ['Esc'], descripcion: 'Cerrar modal, vista previa o limpiar selección' },
    ],
  },
  {
    titulo: 'Tablas de Datos & Operación',
    atajos: [
      { teclas: ['Espacio'], descripcion: 'QuickLook: Vista previa inmediata de comprobante o factura' },
      { teclas: ['Enter'], descripcion: 'Abrir detalle o edición del registro seleccionado' },
      { teclas: ['Clic Der.'], descripcion: 'Menú contextual de fila con opciones rápidas' },
    ],
  },
  {
    titulo: 'Visor de Archivos & Comprobantes',
    atajos: [
      { teclas: ['←', '→'], descripcion: 'Navegar secuencialmente entre archivos adjuntos' },
      { teclas: ['+', '-'], descripcion: 'Aumentar o reducir zoom en imágenes y planos' },
      { teclas: ['0'], descripcion: 'Restaurar zoom y posición original' },
      { teclas: ['R'], descripcion: 'Rotar imagen o documento 90 grados' },
    ],
  },
]

export default function KeyboardShortcutsDialog() {
  const { open, setOpen } = useGlobalShortcuts()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md sm:max-w-lg border-border bg-card p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Keyboard className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Atajos de Teclado SMV Hub
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Optimiza tu flujo de trabajo en compras, almacén y taller.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {GRUPOS_ATAJOS.map((grupo) => (
            <div key={grupo.titulo} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {grupo.titulo}
              </h3>
              <div className="rounded-xl border border-border/80 bg-muted/30 p-1.5 space-y-1">
                {grupo.atajos.map((atajo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-xs text-foreground font-medium">
                      {atajo.descripcion}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {atajo.teclas.map((tecla, tIdx) => (
                        <kbd
                          key={tIdx}
                          className="min-w-[20px] px-1.5 py-0.5 text-center text-[11px] font-mono font-semibold text-foreground bg-card border border-border shadow-xs rounded-md"
                        >
                          {tecla}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
