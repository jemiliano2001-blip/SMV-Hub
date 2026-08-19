'use client'

import AuthGuard from '../AuthGuard'
import MovimientosCaja from './MovimientosCaja'
import ResumenCaja from './ResumenCaja'
import ArqueoCaja from './ArqueoCaja'
import ReportesCaja from './ReportesCaja'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calculator, PieChart, Receipt, Wallet } from 'lucide-react'

const TABS = [
  { valor: 'movimientos', label: 'Movimientos', Icono: Wallet },
  { valor: 'resumen', label: 'Resumen', Icono: PieChart },
  { valor: 'arqueo', label: 'Arqueo de caja', Icono: Calculator },
  { valor: 'reportes', label: 'Reportes', Icono: Receipt },
]

export default function CajaChicaPage() {
  return (
    <AuthGuard>
      <PageShell printClassName="print:bg-white">
        <Tabs defaultValue="movimientos" className="flex flex-col gap-4">
          <PageHeader
            title="Caja chica"
            badge="Efectivo y gastos menores"
            icon={Wallet}
            description="Control de efectivo, comprobantes y gastos menores."
            className="print:hidden"
            actions={
              <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible">
                <TabsList className="h-auto w-max md:w-fit">
                  {TABS.map(({ valor, label, Icono }) => (
                    <TabsTrigger key={valor} value={valor} className="gap-2 px-4 py-2">
                      <Icono className="size-4" aria-hidden />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            }
          />

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6 print:border-0 print:p-0 print:shadow-none">
            <TabsContent value="movimientos">
              <MovimientosCaja />
            </TabsContent>
            <TabsContent value="resumen">
              <ResumenCaja />
            </TabsContent>
            <TabsContent value="arqueo">
              <ArqueoCaja />
            </TabsContent>
            <TabsContent value="reportes">
              <ReportesCaja />
            </TabsContent>
          </div>
        </Tabs>
      </PageShell>
    </AuthGuard>
  )
}
