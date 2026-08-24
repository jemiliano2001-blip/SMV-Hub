'use client'

import { useState } from 'react'
import { History, PlusCircle } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CapturaOdooForm from './CapturaOdooForm'
import HistorialOdooList from './HistorialOdooList'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'
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
          actions={<DrawerPendientesAbastecimiento />}
        />

        <ModuleTabs
          value={tab}
          onValueChange={(v) => setTab(v as TabModo)}
          items={[
            {
              value: 'captura',
              label: (
                <span className="inline-flex items-center gap-2">
                  <PlusCircle className="size-3.5" aria-hidden />
                  Nueva cotización
                </span>
              ),
              content: <CapturaOdooForm onCotizacionCreada={() => setTab('historial')} />,
            },
            {
              value: 'historial',
              label: (
                <span className="inline-flex items-center gap-2">
                  <History className="size-3.5" aria-hidden />
                  Historial
                </span>
              ),
              content: <HistorialOdooList />,
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
