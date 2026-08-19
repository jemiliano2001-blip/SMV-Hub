import AuthGuard from '@/app/AuthGuard'
import ReporteView from '@/app/reportes/ReporteView'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { BarChart3 } from 'lucide-react'

export default function ReportesPage() {
  return (
    <AuthGuard>
      <PageShell maxWidth="7xl" printClassName="print:bg-white">
        <PageHeader
          title="Reportes de compras"
          badge="KPIs y export"
          icon={BarChart3}
          description="Resumen por periodo, agrupación y moneda con export a PDF o correo."
        />
        <ReporteView />
      </PageShell>
    </AuthGuard>
  )
}
