'use client'

import { useState } from 'react'
import { Calculator, PieChart, Receipt, Wallet } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import MovimientosCaja from './MovimientosCaja'
import ResumenCaja from './ResumenCaja'
import ArqueoCaja from './ArqueoCaja'
import ReportesCaja from './ReportesCaja'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'

type TabCaja = 'movimientos' | 'resumen' | 'arqueo' | 'reportes'

export default function CajaChicaPage() {
  const [tab, setTab] = useState<TabCaja>('movimientos')

  return (
    <AuthGuard>
      <PageShell printClassName="print:bg-white">
        <PageHeader
          title="Caja chica"
          badge="Efectivo y gastos menores"
          icon={Wallet}
          description="Control de efectivo, comprobantes y gastos menores."
          className="print:hidden"
        />

        <ModuleTabs
          headerClassName="print:hidden"
          value={tab}
          onValueChange={(v) => setTab(v as TabCaja)}
          items={[
            {
              value: 'movimientos',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Wallet className="size-4" aria-hidden />
                  Movimientos
                </span>
              ),
              content: <MovimientosCaja />,
            },
            {
              value: 'resumen',
              label: (
                <span className="inline-flex items-center gap-2">
                  <PieChart className="size-4" aria-hidden />
                  Resumen
                </span>
              ),
              content: <ResumenCaja />,
            },
            {
              value: 'arqueo',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Calculator className="size-4" aria-hidden />
                  Arqueo de caja
                </span>
              ),
              content: <ArqueoCaja />,
            },
            {
              value: 'reportes',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Receipt className="size-4" aria-hidden />
                  Reportes
                </span>
              ),
              content: <ReportesCaja />,
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
