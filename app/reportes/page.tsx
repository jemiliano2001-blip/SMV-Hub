import AuthGuard from "@/app/AuthGuard"
import ReporteView from "@/app/reportes/ReporteView"

export default function ReportesPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="flex-1">
          <ReporteView />
        </div>
      </div>
    </AuthGuard>
  )
}
