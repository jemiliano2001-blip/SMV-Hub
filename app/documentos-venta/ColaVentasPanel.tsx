'use client'

import type { SolicitudDocumento } from '@/lib/schemas'
import { ordenCompraSolicitud } from '@/lib/documentos-venta-helpers'
import { MessageSquare, Copy } from 'lucide-react'
import { toast } from 'sonner'
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
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-8 text-center">
        No hay solicitudes en la cola.
      </p>
    )
  }

  return (
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
                  className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-amber-300 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {s.tipo === 'factura' ? 'Factura' : 'Remisión'} · {s.odooSoName}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        s.estado === 'pendiente'
                          ? 'text-amber-700'
                          : s.estado === 'en_proceso'
                            ? 'text-sky-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {s.estado.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                    <Copy className="text-slate-500" />
                    <span>Copiar información</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <ContextMenuItem
                      onClick={() => {
                        void navigator.clipboard.writeText(s.partnerName)
                        toast.success('Cliente copiado')
                      }}
                    >
                      <span>Cliente ({s.partnerName})</span>
                    </ContextMenuItem>
                    {oc && (
                      <ContextMenuItem
                        onClick={() => {
                          void navigator.clipboard.writeText(oc)
                          toast.success('Orden de compra copiada')
                        }}
                      >
                        <span>Orden Compra ({oc})</span>
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem
                      onClick={() => {
                        void navigator.clipboard.writeText(s.odooSoName)
                        toast.success('Folio SO copiado')
                      }}
                    >
                      <span>Folio SO ({s.odooSoName})</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        void navigator.clipboard.writeText(s.solicitadoPorNombre)
                        toast.success('Solicitante copiado')
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
  )
}
