'use client'

import { useState } from 'react'
import { FileSpreadsheet, PlusCircle, History } from 'lucide-react'
import AuthGuard from '../AuthGuard'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'
import DrawerPendientesAbastecimiento from '@/components/abastecimiento/DrawerPendientesAbastecimiento'
import OrdenCompraForm from './OrdenCompraForm'
import OrdenesCompraHistorial from './OrdenesCompraHistorial'
import type { OrdenCompraUsa } from '@/lib/schemas'

type TabModo = 'nueva' | 'historial'

export default function OrdenesCompraPage() {
  const [tab, setTab] = useState<TabModo>('nueva')
  const [ordenEnEdicion, setOrdenEnEdicion] = useState<OrdenCompraUsa | null>(null)

  const handleEditarOrden = (orden: OrdenCompraUsa) => {
    setOrdenEnEdicion(orden)
    setTab('nueva')
  }

  const handleNuevaOrden = () => {
    setOrdenEnEdicion(null)
    setTab('nueva')
  }

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Órdenes de compra USA"
          badge="Purchase Orders EUA"
          icon={FileSpreadsheet}
          description="Generación formal de POs en USD, extracción con IA Gemini, seguimiento de estados estilo Odoo y registro en bitácora."
          actions={<DrawerPendientesAbastecimiento />}
        />

        <ModuleTabs
          value={tab}
          onValueChange={(v) => {
            if (v === 'nueva' && tab === 'historial') {
              setOrdenEnEdicion(null)
            }
            setTab(v as TabModo)
          }}
          items={[
            {
              value: 'nueva',
              label: (
                <span className="inline-flex items-center gap-2">
                  <PlusCircle className="size-3.5" aria-hidden />
                  {ordenEnEdicion ? `Editando ${ordenEnEdicion.folio}` : 'Nueva Purchase Order'}
                </span>
              ),
              content: (
                <OrdenCompraForm
                  ordenInicial={ordenEnEdicion}
                  onGuardadoExitoso={() => {
                    setOrdenEnEdicion(null)
                    setTab('historial')
                  }}
                  onCancelar={() => {
                    setOrdenEnEdicion(null)
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
                  Historial de POs
                </span>
              ),
              content: (
                <OrdenesCompraHistorial
                  onEditarOrden={handleEditarOrden}
                  onNuevaOrden={handleNuevaOrden}
                />
              ),
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
