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
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans print:bg-white">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
          <Tabs defaultValue="movimientos">
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs print:hidden">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">Caja Chica</h1>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Efectivo y Gastos Menores
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
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
