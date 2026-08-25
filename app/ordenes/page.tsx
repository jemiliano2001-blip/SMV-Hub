import Link from 'next/link'
import { ClipboardList, Plus } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import OrdenesList from './OrdenesList'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'

/** `q` siembra el buscador: /claves-sat enlaza aquí con la clave seleccionada. */
type SearchParams = Promise<{ q?: string }>

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q } = await searchParams

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
        <OrdenesList busquedaInicial={q} />
      </PageShell>
    </AuthGuard>
  )
}
