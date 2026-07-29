import AuthGuard from "@/app/AuthGuard"
import ReporteView from "@/app/reportes/ReporteView"

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>
}) {
  const params = await searchParams
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="flex-1">
          <ReporteView initialTab={params.vista === "gerencial" ? "gerencial" : "integridad"} />
        </div>
      </div>
    </AuthGuard>
  )
}
