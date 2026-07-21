'use client'

import AuthGuard from '../AuthGuard'
import MovimientosCaja from './MovimientosCaja'
import ResumenCaja from './ResumenCaja'
import ArqueoCaja from './ArqueoCaja'
import ReportesCaja from './ReportesCaja'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Wallet, PieChart, Calculator, Receipt } from 'lucide-react'

const TABS = [
  { valor: 'movimientos', label: 'Movimientos', Icono: Wallet },
  { valor: 'resumen', label: 'Resumen', Icono: PieChart },
  { valor: 'arqueo', label: 'Arqueo de Caja', Icono: Calculator },
  { valor: 'reportes', label: 'Reportes', Icono: Receipt },
]

export default function CajaChicaPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
          <Tabs defaultValue="movimientos">
            <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caja Chica</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Control de efectivo, comprobantes y gastos menores
                </p>
              </div>

              {/* En móvil la lista scrollea en horizontal en vez de envolverse:
                  cuatro tabs apiladas comían media pantalla del celular. */}
              <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0 md:overflow-visible">
                <TabsList className="h-auto w-max md:w-fit">
                  {TABS.map(({ valor, label, Icono }) => (
                    <TabsTrigger
                      key={valor}
                      value={valor}
                      className="gap-2 px-4 py-2 data-[state=active]:text-[#0369A1]"
                    >
                      <Icono className="h-4 w-4" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 print:border-0 print:shadow-none print:p-0">
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
        </div>
      </main>
    </AuthGuard>
  )
}
