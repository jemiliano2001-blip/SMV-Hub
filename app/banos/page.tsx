'use client'

import { useState } from 'react'
import { Calculator, CalendarDays, Clock } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CuentaDiaria from './CuentaDiaria'
import RegistroBanoList from './RegistroBanoList'
import ResumenMensual from './ResumenMensual'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'

type TabBanos = 'registro' | 'diaria' | 'mensual'

export default function BanosPage() {
  const [tab, setTab] = useState<TabBanos>('registro')

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Control de baños"
          badge="Incidencias taller"
          icon={Clock}
          description="Registro de tiempos y resúmenes diarios o mensuales de uso."
        />
        <ModuleTabs
          value={tab}
          onValueChange={(v) => setTab(v as TabBanos)}
          items={[
            {
              value: 'registro',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  Registro
                </span>
              ),
              content: <RegistroBanoList />,
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
                  Resumen
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
