'use client'

import { useState } from 'react'
import { Calculator, CalendarDays, Clock, FileText } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CuentaDiaria from './CuentaDiaria'
import RegistroBanoList from './RegistroBanoList'
import ReporteDiarioBanos from './ReporteDiarioBanos'
import ResumenMensual from './ResumenMensual'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'

type TabBanos = 'registro' | 'reporte-diario' | 'diaria' | 'mensual'

export default function BanosPage() {
  const [tab, setTab] = useState<TabBanos>('registro')

  return (
    <AuthGuard>
      <PageShell
        printClassName="print:bg-white print:p-0"
        innerClassName="print:p-0 print:m-0 print:max-w-none print:gap-0"
      >
        <PageHeader
          title="Control de baños"
          badge="Incidencias taller"
          icon={Clock}
          description="Registro en vivo, reportes formales diarios en PDF y resúmenes mensuales."
          className="print:hidden"
        />
        <ModuleTabs
          headerClassName="print:hidden"
          value={tab}
          onValueChange={(v) => setTab(v as TabBanos)}
          items={[
            {
              value: 'registro',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  Registro en vivo
                </span>
              ),
              content: <RegistroBanoList />,
            },
            {
              value: 'reporte-diario',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="size-3.5" aria-hidden />
                  Reporte Diario (PDF)
                </span>
              ),
              content: <ReporteDiarioBanos />,
            },
            {
              value: 'diaria',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Cuenta diaria
                </span>
              ),
              content: <CuentaDiaria />,
            },
            {
              value: 'mensual',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="size-3.5" aria-hidden />
                  Resumen Mensual
                </span>
              ),
              content: <ResumenMensual />,
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
