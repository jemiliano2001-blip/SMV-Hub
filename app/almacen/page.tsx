'use client'

import { useState } from 'react'
import { PackageMinus, PackagePlus, Truck, Warehouse } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import EntradasList from './EntradasList'
import SalidasList from './SalidasList'
import OrdenesPorRecibir from './OrdenesPorRecibir'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'

type TabAlmacen = 'entradas' | 'salidas' | 'por_recibir'

function AlmacenContent() {
  const [tab, setTab] = useState<TabAlmacen>('entradas')

  return (
    <PageShell>
      <PageHeader
        title="Control de almacén"
        badge="Entradas, salidas y recepción"
        icon={Warehouse}
        description="Gestión de entradas y salidas de materiales, herramientas y recepción de compras."
      />
      <ModuleTabs
        value={tab}
        onValueChange={(v) => setTab(v as TabAlmacen)}
        items={[
          {
            value: 'entradas',
            label: (
              <span className="inline-flex items-center gap-2">
                <PackagePlus className="size-3.5" aria-hidden />
                Entradas
              </span>
            ),
            content: <EntradasList />,
          },
          {
            value: 'salidas',
            label: (
              <span className="inline-flex items-center gap-2">
                <PackageMinus className="size-3.5" aria-hidden />
                Salidas
              </span>
            ),
            content: <SalidasList />,
          },
          {
            value: 'por_recibir',
            label: (
              <span className="inline-flex items-center gap-2">
                <Truck className="size-3.5 text-amber-500" aria-hidden />
                Por recibir
              </span>
            ),
            content: <OrdenesPorRecibir onOrdenRecibida={() => setTab('entradas')} />,
          },
        ]}
      />
    </PageShell>
  )
}

export default function AlmacenPage() {
  return (
    <AuthGuard>
      <AlmacenContent />
    </AuthGuard>
  )
}
