'use client'

import { useState } from 'react'
import { Calculator, CalendarDays, Clock } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import CuentaDiaria from './CuentaDiaria'
import RegistroBanoList from './RegistroBanoList'
import ResumenMensual from './ResumenMensual'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabBanos = 'registro' | 'diaria' | 'mensual'

export default function BanosPage() {
  const [tab, setTab] = useState<TabBanos>('registro')

  return (
    <AuthGuard>
      <PageShell>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabBanos)} className="flex flex-col gap-4">
          <PageHeader
            title="Control de baños"
            badge="Incidencias taller"
            icon={Clock}
            description="Registro de tiempos y resúmenes diarios o mensuales de uso."
            actions={
              <TabsList className="h-auto w-max">
                <TabsTrigger value="registro" className="gap-1.5 text-xs">
                  <Clock className="size-3.5" aria-hidden />
                  Registro
                </TabsTrigger>
                <TabsTrigger value="diaria" className="gap-1.5 text-xs">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Cuenta diaria
                </TabsTrigger>
                <TabsTrigger value="mensual" className="gap-1.5 text-xs">
                  <Calculator className="size-3.5" aria-hidden />
                  Resumen
                </TabsTrigger>
              </TabsList>
            }
          />
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
            <TabsContent value="registro">
              <RegistroBanoList />
            </TabsContent>
            <TabsContent value="diaria">
              <CuentaDiaria />
            </TabsContent>
            <TabsContent value="mensual">
              <ResumenMensual />
            </TabsContent>
          </div>
        </Tabs>
      </PageShell>
    </AuthGuard>
  )
}
