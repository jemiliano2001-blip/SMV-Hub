'use client'

import { useState } from 'react'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, Grid3X3 } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import HorasExtraGrid from './HorasExtraGrid'
import ResumenMensual from './ResumenMensual'
import VistaHoy from './VistaHoy'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import {
  esSemanaActual,
  getSemanaActualISO,
  offsetSemana,
} from '@/lib/horas-extra-parse'
import { puedeEditarHorasExtra } from '@/lib/roles'
import type { Departamento } from '@/lib/schemas'

type Tab = 'semana' | 'hoy' | 'resumen'

function tabInicial(): Tab {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return 'hoy'
  }
  return 'semana'
}

export default function HorasExtraPage() {
  const [departamento, setDepartamento] = useState<Departamento>('diseno')
  const [semana, setSemana] = useState(getSemanaActualISO)
  const [tab, setTab] = useState<Tab>(tabInicial)

  const { usuario } = useUsuario()
  const { plantilla, esSuperAdmin, editaHorasExtra, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  const puedeEditar =
    authBypassActivo() || puedeEditarHorasExtra({ plantilla, esSuperAdmin, editaHorasExtra })
  const soloLectura = !cargandoPermisos && !puedeEditar

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Control de horas extra"
          badge="Personal y nómina"
          icon={Clock}
          description="Registro de horas extraordinarias por departamento del taller."
          className="print:hidden"
        />

        {soloLectura ? (
          <p className="inline-flex w-fit items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 print:hidden">
            <Eye className="size-3" aria-hidden />
            Solo lectura — la captura la hace compras, contabilidad o automatización
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-muted/40 p-3 print:hidden">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              Departamento
            </label>
            <select
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value as Departamento)}
              className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="diseno">Diseño</option>
              <option value="automatizacion">Automatización</option>
              <option value="taller">Taller / Tool Room</option>
              <option value="cnc">CNC / Producción</option>
            </select>
          </div>

          {tab !== 'resumen' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                Semana (miércoles de inicio)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSemana((s) => offsetSemana(s, -1))}
                  className="cursor-pointer rounded-md border border-input bg-card p-1.5 hover:bg-muted"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="size-3.5 text-muted-foreground" />
                </button>
                <input
                  type="date"
                  value={semana}
                  onChange={(e) => setSemana(e.target.value)}
                  className="rounded-md border border-input bg-card px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSemana((s) => offsetSemana(s, 1))}
                  className="cursor-pointer rounded-md border border-input bg-card p-1.5 hover:bg-muted"
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </button>
                {!esSemanaActual(semana) ? (
                  <button
                    type="button"
                    onClick={() => setSemana(getSemanaActualISO())}
                    className="cursor-pointer whitespace-nowrap font-mono text-xs font-bold text-primary hover:underline"
                  >
                    Ir a hoy
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <ModuleTabs
          headerClassName="print:hidden"
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          items={[
            {
              value: 'hoy',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Hoy
                </span>
              ),
              content: (
                <VistaHoy departamento={departamento} semanaInicio={semana} puedeEditar={puedeEditar} />
              ),
            },
            {
              value: 'semana',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Grid3X3 className="size-3.5" aria-hidden />
                  Semana
                </span>
              ),
              content: (
                <HorasExtraGrid departamento={departamento} semanaInicio={semana} puedeEditar={puedeEditar} />
              ),
            },
            {
              value: 'resumen',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="size-3.5" aria-hidden />
                  Resumen
                </span>
              ),
              content: <ResumenMensual departamento={departamento} />,
            },
          ]}
        />
      </PageShell>
    </AuthGuard>
  )
}
