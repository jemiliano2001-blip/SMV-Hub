'use client'

import type { SolicitudDocumento } from '@/lib/schemas'
import { ordenCompraSolicitud } from '@/lib/documentos-venta-helpers'
import { Inbox, MessageSquare, Copy } from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
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
} from '@/components/ui/context-menu'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleSurface from '@/components/layout/ModuleSurface'

export default function ColaVentasPanel({
  solicitudes,
  onAbrir,
}: {
  solicitudes: SolicitudDocumento[]
  onAbrir: (id: string) => void
}) {
  const ordenadas = [...solicitudes].sort((a, b) => {
    const rank = (e: string) =>
      e === 'pendiente' ? 0 : e === 'en_proceso' ? 1 : 2
    const dr = rank(a.estado) - rank(b.estado)
    if (dr !== 0) return dr
    return b.creadoEn.getTime() - a.creadoEn.getTime()
  })

  if (ordenadas.length === 0) {
    return (
      <ModuleEmptyState
        icon={Inbox}
        title="Cola vacía"
        description="No hay solicitudes en la cola."
      />
    )
  }

  return (
    <ModuleSurface className="p-3">
      <ul className="space-y-2">
        {ordenadas.map((s) => {
          const oc = ordenCompraSolicitud(s)
          return (
            <li key={s.id}>
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onAbrir(s.id)}
                    className="w-full cursor-pointer select-none rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-amber-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {s.tipo === 'factura' ? 'Factura' : 'Remisión'} · {s.odooSoName}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          s.estado === 'pendiente'
                            ? 'text-amber-700'
                            : s.estado === 'en_proceso'
                              ? 'text-sky-700'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {s.estado.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.partnerName}
                      {oc ? ` · Orden de compra ${oc}` : ''}{' '}
                      · por {s.solicitadoPorNombre}
                    </p>
                  </button>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-56">
                  <ContextMenuItem onClick={() => onAbrir(s.id)}>
                    <MessageSquare className="text-primary" />
                    <span>Abrir solicitud y chat</span>
                    <ContextMenuShortcut>↵</ContextMenuShortcut>
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Copy className="text-muted-foreground" />
                      <span>Copiar información</span>
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      <ContextMenuItem
                        onClick={() => {
                          void copiarAlPortapapeles(s.partnerName, 'Cliente copiado')
                        }}
                      >
                        <span>Cliente ({s.partnerName})</span>
                      </ContextMenuItem>
                      {oc && (
                        <ContextMenuItem
                          onClick={() => {
                            void copiarAlPortapapeles(oc, 'Orden de compra copiada')
                          }}
                        >
                          <span>Orden Compra ({oc})</span>
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem
                        onClick={() => {
                          void copiarAlPortapapeles(s.odooSoName, 'Folio SO copiado')
                        }}
                      >
                        <span>Folio SO ({s.odooSoName})</span>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => {
                          void copiarAlPortapapeles(s.solicitadoPorNombre, 'Solicitante copiado')
                        }}
                      >
                        <span>Solicitante ({s.solicitadoPorNombre})</span>
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                </ContextMenuContent>
              </ContextMenu>
            </li>
          )
        })}
      </ul>
    </ModuleSurface>
  )
}
