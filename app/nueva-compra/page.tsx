import { ScanLine } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import NuevaCompraFormWrapper from './NuevaCompraFormWrapper'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import DrawerPendientesAbastecimiento from '@/components/abastecimiento/DrawerPendientesAbastecimiento'

type SearchParams = Promise<{ pedidoId?: string; descripcion?: string; requisicionId?: string }>

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { pedidoId, descripcion, requisicionId } = await searchParams

  return (
    <AuthGuard>
      <PageShell maxWidth="3xl">
        <PageHeader
          title="Nueva compra americana"
          badge="Extracción IA"
          icon={ScanLine}
          description="Escaneo de facturas en PDF o imagen, o captura rápida de datos."
          actions={<DrawerPendientesAbastecimiento />}
        />
        <NuevaCompraFormWrapper
          pedidoId={pedidoId}
          descripcionInicial={descripcion}
          requisicionId={requisicionId}
        />
      </PageShell>
    </AuthGuard>
  )
}
