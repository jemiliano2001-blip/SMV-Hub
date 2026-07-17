import AuthGuard from "@/app/AuthGuard"
import ReporteContableView from "@/app/reportes/contable/ReporteContableView"

export default function ReporteContablePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="flex-1">
          <ReporteContableView />
        </div>
      </div>
    </AuthGuard>
  )
}
