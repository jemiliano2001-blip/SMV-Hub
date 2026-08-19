import { Warehouse } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import PedidosAlmacenView from './PedidosAlmacenView'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function PedidosAlmacenPage() {
  return (
    <AuthGuard>
      <PageShell maxWidth="4xl">
        <PageHeader
          title="Pedidos de almacén"
          badge="Requerimientos"
          icon={Warehouse}
          description="Registra requerimientos inmediatos de material o herramienta para convertirlos en compras."
        />
        <PedidosAlmacenView />
      </PageShell>
    </AuthGuard>
  )
}
