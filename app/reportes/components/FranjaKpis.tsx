import type { Kpis } from "@/lib/reportes"

type Props = { kpis: Kpis; moneda: string }

function KpiCard({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:shadow-none print:border-0 print:p-0 print:px-4 print:py-2.5 print:bg-transparent">
      <p className="text-xs text-gray-500 mb-1 print:text-[7.5px] print:mb-1 print:font-semibold print:uppercase print:tracking-widest">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight print:font-mono print:font-medium print:text-[15px] print:leading-none">{valor}</p>
      {subtitulo && <p className="text-xs text-gray-400 mt-1 print:text-[7.5px] print:mt-1">{subtitulo}</p>}
    </div>
  )
}

export default function FranjaKpis({ kpis, moneda }: Props) {
  const fmt = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-0 print:mb-3 print:border-b-2 print:border-black print:divide-x print:divide-gray-200">
      <KpiCard
        titulo="Total comprado"
        valor={fmt.format(kpis.totalComprado)}
        subtitulo="IVA incluido"
      />
      <KpiCard
        titulo="Órdenes (PO)"
        valor={String(kpis.numOrdenes)}
        subtitulo={`${kpis.numArticulos} artículos`}
      />
      <KpiCard
        titulo="Proveedores"
        valor={String(kpis.numProveedores)}
        subtitulo=""
      />
      <KpiCard
        titulo="Destino principal"
        valor={kpis.destinoTop || "—"}
        subtitulo={kpis.destinoTop ? `${kpis.destinoTopPct.toFixed(1)}% del gasto` : ""}
      />
    </div>
  )
}
