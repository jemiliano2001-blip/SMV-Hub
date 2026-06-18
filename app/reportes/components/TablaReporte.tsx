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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b-2 border-gray-300">
            {["Referencia","Día","Proveedor","Descripción","Cant.","P. Unitario","Subtotal","Total","Requisitor","Cuenta Cargo","Destino"].map((h, i) => (
              <th
                key={h}
                className={`pb-2 pr-3 text-xs font-semibold text-gray-600 ${i >= 4 && i <= 7 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.clave}>
              <tr className="bg-blue-50 print:bg-gray-100">
                <td
                  colSpan={COLS}
                  className="py-2 px-2 text-sm font-semibold text-blue-900 border-t border-blue-200"
                >
                  {grupo.clave}
                </td>
              </tr>

              {grupo.lineas.map((linea, i) => (
                <tr
                  key={`${grupo.clave}-${i}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">{linea.referencia}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-xs">{fmtFecha(linea.dia)}</td>
                  <td className="py-1.5 pr-3">{linea.proveedor}</td>
                  <td className="py-1.5 pr-3 max-w-[200px] truncate" title={linea.descripcion}>
                    {linea.descripcion}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{linea.cantidad ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {linea.precioUnitario != null ? fmt(linea.precioUnitario) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(linea.subtotal)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-medium">{fmt(linea.total)}</td>
                  <td className="py-1.5 pr-3 text-xs">{linea.requisitor || "—"}</td>
                  <td className="py-1.5 pr-3 text-xs">{linea.cuentaCargo || "—"}</td>
                  <td className="py-1.5 text-xs">{linea.destino || "—"}</td>
                </tr>
              ))}

              <tr className="border-t border-gray-300 bg-gray-50">
                <td colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold text-gray-600">
                  Subtotal {grupo.clave}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800">
                  {fmt(grupo.subtotal)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-gray-800">
                  {fmt(grupo.total)}
                </td>
                <td colSpan={3} />
              </tr>
            </Fragment>
          ))}

          <tr className="border-t-2 border-gray-900">
            <td colSpan={7} className="py-2.5 pr-3 text-right text-sm font-bold text-gray-900 uppercase tracking-wide">
              Total General
            </td>
            <td className="py-2.5 pr-3 text-right tabular-nums text-base font-bold text-gray-900">
              {fmt(totalGeneral)}
            </td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
