import RequisicionesList from './RequisicionesList'
import AuthGuard from '../AuthGuard'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { ClipboardList } from 'lucide-react'

export default function RequisicionesPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Requisiciones de compra"
          badge="Ingeniería y taller"
          icon={ClipboardList}
          description="Control utilitario de solicitudes de material y automatización levantadas por el equipo."
        />
        <RequisicionesList />
      </PageShell>
    </AuthGuard>
  )
}
