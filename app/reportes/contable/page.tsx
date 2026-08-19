import AuthGuard from '@/app/AuthGuard'
import ReporteContableView from '@/app/reportes/contable/ReporteContableView'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { FileSpreadsheet } from 'lucide-react'

export default function ReporteContablePage() {
  return (
    <AuthGuard>
      <PageShell maxWidth="7xl" printClassName="print:bg-white">
        <PageHeader
          title="Cierre contable"
          badge="SAT · lotes"
          icon={FileSpreadsheet}
          description="Agrupa órdenes pendientes, traduce descripciones y asigna claves SAT en batch."
        />
        <ReporteContableView />
      </PageShell>
    </AuthGuard>
  )
}
