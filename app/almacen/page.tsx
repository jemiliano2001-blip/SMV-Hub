'use client'

import { useState } from 'react'
import { PackageMinus, PackagePlus, Truck, Warehouse } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import EntradasList from './EntradasList'
import SalidasList from './SalidasList'
import OrdenesPorRecibir from './OrdenesPorRecibir'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabAlmacen = 'entradas' | 'salidas' | 'por_recibir'

function AlmacenContent() {
  const [tab, setTab] = useState<TabAlmacen>('entradas')

  return (
    <PageShell>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabAlmacen)} className="flex flex-col gap-4">
        <PageHeader
          title="Control de almacén"
          badge="Entradas, salidas y recepción"
          icon={Warehouse}
          description="Gestión de entradas y salidas de materiales, herramientas y recepción de compras."
          actions={
            <TabsList>
              <TabsTrigger value="entradas" className="gap-2 text-xs">
                <PackagePlus className="size-3.5" aria-hidden />
                Entradas
              </TabsTrigger>
              <TabsTrigger value="salidas" className="gap-2 text-xs">
                <PackageMinus className="size-3.5" aria-hidden />
                Salidas
              </TabsTrigger>
              <TabsTrigger value="por_recibir" className="gap-2 text-xs">
                <Truck className="size-3.5 text-amber-400" aria-hidden />
                Por recibir
              </TabsTrigger>
            </TabsList>
          }
        />
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
          <TabsContent value="entradas">
            <EntradasList />
          </TabsContent>
          <TabsContent value="salidas">
            <SalidasList />
          </TabsContent>
          <TabsContent value="por_recibir">
            <OrdenesPorRecibir onOrdenRecibida={() => setTab('entradas')} />
          </TabsContent>
        </div>
      </Tabs>
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
