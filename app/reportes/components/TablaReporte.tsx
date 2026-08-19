import { Fragment } from "react"
import type { Grupo } from "@/lib/reportes"
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
      <p className="text-sm text-gray-500 py-8 text-center">
        No hay compras en este periodo con los filtros seleccionados.
      </p>
    )
  }

  const totalSubtotales = grupos.reduce((s, g) => s + g.subtotal, 0)

  return (
    <Table className="border-collapse text-sm min-w-[900px] print:min-w-0 print:text-[9px]">
        <TableHeader>
          <TableRow className="border-b-2 border-gray-300 print:border-b-0 print:bg-[#111111]">
            {["Referencia","Día","Proveedor","Descripción","Cant.","P. Unitario","Subtotal","Total","Requisitor","Cuenta Cargo","Destino"].map((h, i) => (
              <TableHead
                key={h}
                className={`h-auto pb-2 pr-3 text-xs font-semibold text-gray-600 print:py-1.5 print:px-2 print:text-[7.5px] print:font-medium print:tracking-widest print:uppercase print:text-white ${i >= 4 && i <= 7 ? "text-right" : "text-left"} ${i === 0 ? "print:hidden" : ""}`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.clave}>
              <TableRow className="bg-blue-50 print:bg-[#f0f0f0] grupo-header">
                <TableCell
                  colSpan={COLS}
                  className="py-2 px-2 text-sm font-semibold text-blue-900 border-t border-blue-200 print:text-black print:font-bold print:text-[9.5px]"
                >
                  {grupo.clave}
                </TableCell>
              </TableRow>

              {grupo.lineas.map((linea, i) => (
                <TableRow
                  key={`${grupo.clave}-${i}`}
                  className={`border-b border-gray-100 hover:bg-gray-50 grupo-linea print:hover:bg-transparent ${i % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}
                >
                  <TableCell className="py-1.5 pr-3 font-mono text-xs text-gray-500 print:hidden">{linea.referencia}</TableCell>
                  <TableCell className="py-1.5 pr-3 whitespace-nowrap text-xs print:font-mono print:text-gray-600">{fmtFecha(linea.dia)}</TableCell>
                  <TableCell className="py-1.5 pr-3">{linea.proveedor}</TableCell>
                  <TableCell className="py-1.5 pr-3 max-w-[200px] truncate print:max-w-[160px] print:text-[8.5px]" title={linea.descripcion}>
                    {linea.descripcion}
                  </TableCell>
                  <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{linea.cantidad ?? "—"}</TableCell>
                  <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">
                    {linea.precioUnitario != null ? fmt(linea.precioUnitario) : "—"}
                  </TableCell>
                  <TableCell className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{fmt(linea.subtotal)}</TableCell>
                  <TableCell className="py-1.5 pr-3 text-right tabular-nums font-medium print:font-mono">{fmt(linea.total)}</TableCell>
                  <TableCell className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.requisitor || "—"}</TableCell>
                  <TableCell className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.cuentaCargo || "—"}</TableCell>
                  <TableCell className="py-1.5 text-xs print:text-gray-600">{linea.destino || "—"}</TableCell>
                </TableRow>
              ))}

              <TableRow className="border-t border-gray-300 bg-gray-50 grupo-subtotal print:bg-[#f5f5f5]">
                <TableCell colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold text-gray-600 print:text-[8.5px]">
                  Subtotal {grupo.clave}
                </TableCell>
                <TableCell className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800 print:font-mono print:text-[10px]">
                  {fmt(grupo.subtotal)}
                </TableCell>
                <TableCell className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800 print:font-mono print:text-[10px]">
                  {fmt(grupo.total)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </Fragment>
          ))}

          <TableRow className="border-t-2 border-gray-900 total-general print:border-t-[3px] print:border-double print:border-black">
            <TableCell colSpan={6} className="py-2.5 pr-3 text-right text-sm font-bold text-gray-900 uppercase tracking-wide print:text-[10.5px] print:py-2">
              Total General
            </TableCell>
            <TableCell className="py-2.5 pr-3 text-right tabular-nums text-sm font-bold text-gray-900 print:font-mono print:text-[11.5px] print:py-2">
              {fmt(totalSubtotales)}
            </TableCell>
            <TableCell className="py-2.5 pr-3 text-right tabular-nums text-base font-bold text-gray-900 print:font-mono print:text-[13px] print:py-2">
              {fmt(totalGeneral)}
            </TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        </TableBody>
      </Table>
  )
}
