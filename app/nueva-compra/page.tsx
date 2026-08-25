import { ScanLine } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import NuevaCompraFormWrapper from './NuevaCompraFormWrapper'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import DrawerPendientesAbastecimiento from '@/components/abastecimiento/DrawerPendientesAbastecimiento'

type SearchParams = Promise<{
  pedidoId?: string
  descripcion?: string
  requisicionId?: string
  proveedor?: string
  numeroParte?: string
  precioUnitario?: string
  cantidad?: string
  total?: string
  linkProveedor?: string
  requisitor?: string
  moneda?: string
  cotizacionId?: string
  claveSat?: string
}>

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const {
    pedidoId,
    descripcion,
    requisicionId,
    proveedor,
    numeroParte,
    precioUnitario,
    cantidad,
    total,
    linkProveedor,
    requisitor,
    moneda,
    cotizacionId,
    claveSat,
  } = await searchParams

  const cantNum = cantidad ? parseFloat(cantidad) : null
  const pUnitNum = precioUnitario ? parseFloat(precioUnitario) : null
  const totNum = total ? parseFloat(total) : null

  const initialData =
    proveedor || numeroParte || precioUnitario || linkProveedor || cotizacionId
      ? {
          proveedor,
          numeroParte,
          descripcion,
          cantidad: !isNaN(cantNum ?? NaN) ? cantNum : null,
          precioUnitario: !isNaN(pUnitNum ?? NaN) ? pUnitNum : null,
          total: !isNaN(totNum ?? NaN) ? totNum : null,
          linkProveedor,
          requisitor,
          moneda: moneda === 'MXN' ? ('MXN' as const) : ('USD' as const),
          cotizacionId,
          claveSat,
        }
      : undefined

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
          initialData={initialData}
        />
      </PageShell>
    </AuthGuard>
  )
}

