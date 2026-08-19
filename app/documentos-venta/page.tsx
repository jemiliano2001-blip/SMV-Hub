import { Suspense } from 'react'
import { FileText } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import DocumentosVentaView from './DocumentosVentaView'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function DocumentosVentaPage() {
  return (
    <AuthGuard>
      <PageShell maxWidth="5xl">
        <PageHeader
          title="Documentos de venta"
          badge="Remisión / Factura"
          icon={FileText}
          description="Pide remisiones o facturas de órdenes de venta Odoo y chatea con ventas en Hub."
        />
        <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>}>
          <DocumentosVentaView />
        </Suspense>
      </PageShell>
    </AuthGuard>
  )
}
