import { FileSpreadsheet } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CotizacionesTabs from './CotizacionesTabs'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function CotizacionesPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Cotizaciones"
          badge="Histórico MX / USA"
          icon={FileSpreadsheet}
          description="Piezas cotizadas y compras americanas ya hechas, para buscar un precio viejo."
        />
        <CotizacionesTabs />
      </PageShell>
    </AuthGuard>
  )
}
