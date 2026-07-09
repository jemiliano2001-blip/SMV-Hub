import { Fragment } from "react"
import type { Grupo } from "@/lib/reportes"

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
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm border-collapse min-w-[900px] print:min-w-0 print:text-[9px]">
        <thead>
          <tr className="border-b-2 border-gray-300 print:border-b-0 print:bg-[#111111]">
            {["Referencia","Día","Proveedor","Descripción","Cant.","P. Unitario","Subtotal","Total","Requisitor","Cuenta Cargo","Destino"].map((h, i) => (
              <th
                key={h}
                className={`pb-2 pr-3 text-xs font-semibold text-gray-600 print:py-1.5 print:px-2 print:text-[7.5px] print:font-medium print:tracking-widest print:uppercase print:text-white ${i >= 4 && i <= 7 ? "text-right" : "text-left"} ${i === 0 ? "print:hidden" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.clave}>
              <tr className="bg-blue-50 print:bg-[#f0f0f0] grupo-header">
                <td
                  colSpan={COLS}
                  className="py-2 px-2 text-sm font-semibold text-blue-900 border-t border-blue-200 print:text-black print:font-bold print:text-[9.5px]"
                >
                  {grupo.clave}
                </td>
              </tr>

              {grupo.lineas.map((linea, i) => (
                <tr
                  key={`${grupo.clave}-${i}`}
                  className={`border-b border-gray-100 hover:bg-gray-50 grupo-linea print:hover:bg-transparent ${i % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}
                >
                  <td className="py-1.5 pr-3 font-mono text-xs text-gray-500 print:hidden">{linea.referencia}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-xs print:font-mono print:text-gray-600">{fmtFecha(linea.dia)}</td>
                  <td className="py-1.5 pr-3">{linea.proveedor}</td>
                  <td className="py-1.5 pr-3 max-w-[200px] truncate print:max-w-[160px] print:text-[8.5px]" title={linea.descripcion}>
                    {linea.descripcion}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{linea.cantidad ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums print:font-mono">
                    {linea.precioUnitario != null ? fmt(linea.precioUnitario) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums print:font-mono">{fmt(linea.subtotal)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-medium print:font-mono">{fmt(linea.total)}</td>
                  <td className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.requisitor || "—"}</td>
                  <td className="py-1.5 pr-3 text-xs print:text-gray-600">{linea.cuentaCargo || "—"}</td>
                  <td className="py-1.5 text-xs print:text-gray-600">{linea.destino || "—"}</td>
                </tr>
              ))}

              <tr className="border-t border-gray-300 bg-gray-50 grupo-subtotal print:bg-[#f5f5f5]">
                <td colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold text-gray-600 print:text-[8.5px]">
                  Subtotal {grupo.clave}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800 print:font-mono print:text-[10px]">
                  {fmt(grupo.subtotal)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800 print:font-mono print:text-[10px]">
                  {fmt(grupo.total)}
                </td>
                <td colSpan={3} />
              </tr>
            </Fragment>
          ))}

          <tr className="border-t-2 border-gray-900 total-general print:border-t-[3px] print:border-double print:border-black">
            <td colSpan={6} className="py-2.5 pr-3 text-right text-sm font-bold text-gray-900 uppercase tracking-wide print:text-[10.5px] print:py-2">
              Total General
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums text-sm font-bold text-gray-900 print:font-mono print:text-[11.5px] print:py-2">
              {fmt(totalSubtotales)}
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums text-base font-bold text-gray-900 print:font-mono print:text-[13px] print:py-2">
              {fmt(totalGeneral)}
            </td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
