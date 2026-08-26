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
import type { BorradorComprasOdoo } from './components/tipos-captura'
import type { RegistroCotizacionOdoo } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'

type TabModo = 'captura' | 'historial'

export default function ComprasOdooPage() {
  const [tab, setTab] = useState<TabModo>('captura')
  const [datosRecotizar, setDatosRecotizar] = useState<Partial<BorradorComprasOdoo> | null>(null)
  const [capturaKey, setCapturaKey] = useState<string>('captura-init')

  const handleRecotizar = (registro: RegistroCotizacionOdoo) => {
    setDatosRecotizar({
      proveedor: registro.proveedor,
      proveedorId: registro.proveedorId ?? null,
      referenciaProveedor: registro.referenciaProveedor || '',
      moneda: registro.moneda,
      fecha: fechaHoyLocal(),
      fechaRecepcion: fechaHoyLocal(),
      notas: registro.notas || '',
      partidas: (registro.partidas || []).map((p, idx) => ({
        ...p,
        id: `recot_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      })),
    })
    setCapturaKey(`recot-${Date.now()}`)
    setTab('captura')
  }

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
              content: (
                <CapturaOdooForm
                  key={capturaKey}
                  initialData={datosRecotizar}
                  onCotizacionCreada={() => {
                    setDatosRecotizar(null)
                    setTab('historial')
                  }}
                />
              ),
            },
            {
              value: 'historial',
              label: (
                <span className="inline-flex items-center gap-2">
                  <History className="size-3.5" aria-hidden />
                  Historial
                </span>
              ),
              content: <HistorialOdooList onRecotizar={handleRecotizar} />,
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
