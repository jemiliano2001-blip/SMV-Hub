'use client'

import { useState } from 'react'
import { History, PlusCircle } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CapturaOdooForm from './CapturaOdooForm'
import HistorialOdooList from './HistorialOdooList'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DrawerPendientesAbastecimiento from '@/components/abastecimiento/DrawerPendientesAbastecimiento'

type TabModo = 'captura' | 'historial'

export default function ComprasOdooPage() {
  const [tab, setTab] = useState<TabModo>('captura')

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Compras Odoo"
          badge="Cotizaciones rápidas"
          icon={PlusCircle}
          description="Pega filas desde Excel o escanea cotizaciones con IA para generar solicitudes en Odoo."
          actions={
            <div className="flex items-center gap-2">
              <DrawerPendientesAbastecimiento />
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabModo)}>
                <TabsList>
                  <TabsTrigger value="captura" className="gap-2 text-xs">
                    <PlusCircle className="size-3.5" aria-hidden />
                    Nueva cotización
                  </TabsTrigger>
                  <TabsTrigger value="historial" className="gap-2 text-xs">
                    <History className="size-3.5" aria-hidden />
                    Historial
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          }
        />

        {tab === 'captura' ? (
          <CapturaOdooForm onCotizacionCreada={() => setTab('historial')} />
        ) : (
          <HistorialOdooList />
        )}
      </PageShell>
    </AuthGuard>
  )
}
