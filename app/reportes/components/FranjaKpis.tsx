import ModuleSurface from "@/components/layout/ModuleSurface"
import type { Kpis } from "@/lib/reportes"

type Props = { kpis: Kpis; moneda: string }

function KpiCard({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo: string }) {
  return (
    <ModuleSurface className="p-4 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:px-4 print:py-2.5 print:shadow-none">
      <p className="mb-1 text-xs text-muted-foreground print:mb-1 print:text-[7.5px] print:font-semibold print:uppercase print:tracking-widest">{titulo}</p>
      <p className="text-2xl font-bold leading-tight text-foreground tabular-nums print:font-mono print:text-[15px] print:font-medium print:leading-none">{valor}</p>
      {subtitulo && <p className="mt-1 text-xs text-muted-foreground print:mt-1 print:text-[7.5px]">{subtitulo}</p>}
    </ModuleSurface>
  )
}

export default function FranjaKpis({ kpis, moneda }: Props) {
  const fmt = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  })

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 print:mb-3 print:grid-cols-4 print:gap-0 print:divide-x print:divide-gray-200 print:border-b-2 print:border-black">
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
