import AuthGuard from "@/app/AuthGuard"
import ReporteView from "@/app/reportes/ReporteView"

export default function ReportesPage() {
  return (
    <AuthGuard>
      <ReporteView />
    </AuthGuard>
  )
}
