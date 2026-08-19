import Link from 'next/link'
import { ClipboardList, Plus } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import OrdenesList from './OrdenesList'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'

export default function OrdenesPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Órdenes de compra"
          badge="Bitácora EUA"
          icon={ClipboardList}
          description="Consulta utilitaria, estatus y notificaciones de compras registradas."
          actions={
            <Button size="sm" asChild>
              <Link href="/nueva-compra">
                <Plus data-icon="inline-start" />
                Nueva compra
              </Link>
            </Button>
          }
        />
        <OrdenesList />
      </PageShell>
    </AuthGuard>
  )
}
