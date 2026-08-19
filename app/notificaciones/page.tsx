import { Bell } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import NotificacionesView from './NotificacionesView'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function NotificacionesPage() {
  return (
    <AuthGuard>
      <PageShell maxWidth="3xl">
        <PageHeader
          title="Notificaciones"
          badge="Operación"
          icon={Bell}
          description="Avisos de pedidos, requisiciones, documentos de venta y operación del taller."
        />
        <NotificacionesView />
      </PageShell>
    </AuthGuard>
  )
}
