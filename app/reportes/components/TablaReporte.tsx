import { Fragment } from "react"
import type { Grupo } from "@/lib/reportes"
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Props = { grupos: Grupo[]; totalGeneral: number; moneda: string }

const COLS = 11

function fmtFecha(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function TablaReporte({ grupos, totalGeneral, moneda }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
    }).format(n)

  if (grupos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay compras en este periodo con los filtros seleccionados.
      </p>
    )
  }

  const totalSubtotales = grupos.reduce((s, g) => s + g.subtotal, 0)

  return (
    <Table className="min-w-[900px] border-collapse text-sm print:min-w-0 print:text-[9px]">
        <TableHeader>
          <TableRow className="border-b-2 border-border print:border-b-0 print:bg-[#111111]">
            {["Referencia","Día","Proveedor","Descripción","Cant.","P. Unitario","Subtotal","Total","Requisitor","Cuenta Cargo","Destino"].map((h, i) => (
              <TableHead
                key={h}
                className={`h-auto pb-2 pr-3 text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:tracking-widest print:uppercase print:text-white ${i >= 4 && i <= 7 ? "text-right" : "text-left"} ${i === 0 ? "print:hidden" : ""}`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.clave}>
              <TableRow className="grupo-header border-t border-primary/20 bg-primary/10 print:bg-[#f0f0f0]">
                <TableCell
                  colSpan={COLS}
                  className="border-t border-primary/20 px-2 py-2 text-sm font-semibold text-primary print:text-[9.5px] print:font-bold print:text-black"
                >
                  {grupo.clave}
                </TableCell>
              </TableRow>

              {grupo.lineas.map((linea, i) => {
                const subtotalStr = fmt(linea.subtotal)
                const totalStr = fmt(linea.total)

                return (
                  <ContextMenu key={`${grupo.clave}-${i}`}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className={`grupo-linea cursor-pointer select-none border-b border-border hover:bg-muted print:hover:bg-transparent ${i % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}
                      >
                        <TableCell className="py-1.5 pr-3 font-mono text-xs text-muted-foreground print:hidden">{linea.referencia}</TableCell>
                        <TableCell className="whitespace-nowrap py-1.5 pr-3 text-xs print:font-mono print:text-gray-600">{fmtFecha(linea.dia)}</TableCell>
                        <TableCell className="py-1.5 pr-3">{linea.proveedor}</TableCell>
                        <TableCell className="max-w-[200px] truncate py-1.5 pr-3 print:max-w-[160px] print:text-[8.5px]" title={linea.descripcion}>
                          {linea.descripcion}
                        </TableCell>
                        <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{linea.cantidad ?? "—"}</TableCell>
                        <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">
                          {linea.precioUnitario != null ? fmt(linea.precioUnitario) : "—"}
                        </TableCell>
                        <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{subtotalStr}</TableCell>
                        <TableCell className="py-1.5 pr-3 text-right font-medium tabular-nums print:font-mono">{totalStr}</TableCell>
                        <TableCell className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.requisitor || "—"}</TableCell>
                        <TableCell className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.cuentaCargo || "—"}</TableCell>
                        <TableCell className="py-1.5 text-xs print:text-gray-600">{linea.destino || "—"}</TableCell>
                      </TableRow>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuItem
                        onClick={() => {
                          window.location.href = `/ordenes`
                        }}
                      >
                        <ExternalLink className="text-primary" />
                        <span>Ver en Órdenes de Compra</span>
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
                              void navigator.clipboard.writeText(linea.descripcion)
                              toast.success('Descripción copiada')
                            }}
                          >
                            <span>Descripción</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(linea.proveedor)
                              toast.success('Proveedor copiado')
                            }}
                          >
                            <span>Proveedor ({linea.proveedor})</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(totalStr)
                              toast.success('Total copiado', { description: totalStr })
                            }}
                          >
                            <span>Total ({totalStr})</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(subtotalStr)
                              toast.success('Subtotal copiado')
                            }}
                          >
                            <span>Subtotal ({subtotalStr})</span>
                          </ContextMenuItem>
                          {linea.referencia && (
                            <ContextMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(linea.referencia)
                                toast.success('Referencia copiada')
                              }}
                            >
                              <span>Referencia ({linea.referencia})</span>
                            </ContextMenuItem>
                          )}
                          {linea.requisitor && (
                            <ContextMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(linea.requisitor)
                                toast.success('Requisitor copiado')
                              }}
                            >
                              <span>Requisitor ({linea.requisitor})</span>
                            </ContextMenuItem>
                          )}
                          {(linea.cuentaCargo || linea.destino) && (
                            <ContextMenuItem
                              onClick={() => {
                                const ccDest = [linea.cuentaCargo, linea.destino].filter(Boolean).join(' / ')
                                void navigator.clipboard.writeText(ccDest)
                                toast.success('Cuenta / Destino copiado')
                              }}
                            >
                              <span>Cuenta / Destino</span>
                            </ContextMenuItem>
                          )}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}

              <TableRow className="grupo-subtotal border-t border-border bg-muted print:bg-[#f5f5f5]">
                <TableCell colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold text-muted-foreground print:text-[8.5px]">
                  Subtotal {grupo.clave}
                </TableCell>
                <TableCell className="py-1.5 pr-3 text-right font-semibold text-foreground tabular-nums print:font-mono print:text-[10px]">
                  {fmt(grupo.subtotal)}
                </TableCell>
                <TableCell className="py-1.5 pr-3 text-right font-semibold text-foreground tabular-nums print:font-mono print:text-[10px]">
                  {fmt(grupo.total)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </Fragment>
          ))}

          <TableRow className="total-general border-t-2 border-foreground print:border-t-[3px] print:border-double print:border-black">
            <TableCell colSpan={6} className="py-2.5 pr-3 text-right text-sm font-bold uppercase tracking-wide text-foreground print:py-2 print:text-[10.5px]">
              Total General
            </TableCell>
            <TableCell className="py-2.5 pr-3 text-right text-sm font-bold text-foreground tabular-nums print:py-2 print:font-mono print:text-[11.5px]">
              {fmt(totalSubtotales)}
            </TableCell>
            <TableCell className="py-2.5 pr-3 text-right text-base font-bold text-foreground tabular-nums print:py-2 print:font-mono print:text-[13px]">
              {fmt(totalGeneral)}
            </TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        </TableBody>
      </Table>
  )
}
