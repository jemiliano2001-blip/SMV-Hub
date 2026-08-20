'use client'

import {
  Award,
  CheckCircle2,
  RefreshCw,
  Zap,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Proveedor, CategoriaProveedor } from '@/lib/schemas'
import { CATEGORIAS_PROVEEDOR } from '@/lib/proveedores/categorias-proveedor'
import type { ScorecardAutomatica } from '@/lib/proveedores-inteligencia-cruzada'
import type { MatrizBackupProveedores } from '@/lib/proveedores'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PanelInteligencia360Props {
  proveedores: Proveedor[]
  scorecards: ScorecardAutomatica[]
  onGenerarScorecards: () => void
  guardandoScorecards: boolean
  onActualizarVentanaScorecards?: () => void
  cargandoVentanaScorecards?: boolean
  mapeoBackup: MatrizBackupProveedores
  onActualizarMapeoBackup: (nuevo: MatrizBackupProveedores) => void
}

const MAPEO_BACKUP_DEFAULT: MatrizBackupProveedores = {
  endmills: { primarioId: '', backupId: '' },
  insertos: { primarioId: '', backupId: '' },
  tooling: { primarioId: '', backupId: '' },
  consumibles: { primarioId: '', backupId: '' },
  otros: { primarioId: '', backupId: '' },
}

export default function PanelInteligencia360({
  proveedores,
  scorecards,
  onGenerarScorecards,
  guardandoScorecards,
  onActualizarVentanaScorecards,
  cargandoVentanaScorecards = false,
  mapeoBackup,
  onActualizarMapeoBackup,
}: PanelInteligencia360Props) {
  const descripcionesCategoria: Record<CategoriaProveedor, string> = {
    endmills: 'Carburo sólido, aluminio y aleaciones exóticas',
    insertos: 'PVD, CVD para aceros, inox y hierro gris',
    tooling: 'Conos CAT40/BT40, boquillas ER, prensas de precisión',
    consumibles: 'Refrigerantes, lubricantes, insertos de roscado, brocas',
    otros: 'Accesorios generales de máquina e instrumentos de medición',
  }

  const categoriasLista = CATEGORIAS_PROVEEDOR.map((cat) => ({
    id: cat.id as CategoriaProveedor,
    titulo: cat.etiqueta,
    descripcion: descripcionesCategoria[cat.id as CategoriaProveedor],
  }))

  const getProveedoresPorCategoria = (cat: CategoriaProveedor) => {
    return proveedores.filter((p) => p.categorias.includes(cat) || p.categorias.includes('otros'))
  }

  const handleSeleccionarPrimario = (cat: string, id: string) => {
    onActualizarMapeoBackup({
      ...mapeoBackup,
      [cat]: { ...(mapeoBackup[cat] ?? MAPEO_BACKUP_DEFAULT[cat]), primarioId: id },
    })
  }

  const handleSeleccionarBackup = (cat: string, id: string) => {
    onActualizarMapeoBackup({
      ...mapeoBackup,
      [cat]: { ...(mapeoBackup[cat] ?? MAPEO_BACKUP_DEFAULT[cat]), backupId: id },
    })
  }

  return (
    <div className="space-y-6">
      {/* 🟢 FEATURE C: MATRIZ DE PROVEEDOR PRIMARIO VS BACKUP */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-50 text-primary border border-sky-200">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Matriz de Cobertura: Proveedor Primario vs Backup
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Garantiza la continuidad operativa del taller asignando un proveedor principal y una alternativa de respaldo por categoría de herramental.
            </p>
          </div>
          <Badge variant="outline" className="bg-sky-50 text-primary border-sky-200 text-xs w-fit">
            Contingencia CNC Activa
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {categoriasLista.map((catItem) => {
            const disponibles = getProveedoresPorCategoria(catItem.id)
            const selPrimario = mapeoBackup[catItem.id]?.primarioId || disponibles[0]?.id || ''
            const selBackup = mapeoBackup[catItem.id]?.backupId || disponibles[1]?.id || ''

            const provPrimario = proveedores.find((p) => p.id === selPrimario)
            const provBackup = proveedores.find((p) => p.id === selBackup)

            return (
              <div
                key={catItem.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {catItem.titulo}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {catItem.descripcion}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Selector Primario */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Primario
                    </label>
                    <select
                      value={selPrimario}
                      onChange={(e) => handleSeleccionarPrimario(catItem.id, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary"
                    >
                      <option value="">Seleccionar primario...</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.pais === 'Estados Unidos' ? 'USA' : 'MX'})
                        </option>
                      ))}
                    </select>
                    {provPrimario && (
                      <div className="text-[10px] text-slate-500">
                        Lead time: <strong className="text-slate-700">{provPrimario.leadTimeDias || '3-5'}d</strong> | Rating: ⭐ {provPrimario.calificacion || 5}.0
                      </div>
                    )}
                  </div>

                  {/* Selector Backup */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Backup (Respaldo)
                    </label>
                    <select
                      value={selBackup}
                      onChange={(e) => handleSeleccionarBackup(catItem.id, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary"
                    >
                      <option value="">Seleccionar backup...</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.pais === 'Estados Unidos' ? 'USA' : 'MX'})
                        </option>
                      ))}
                    </select>
                    {provBackup && (
                      <div className="text-[10px] text-slate-500">
                        Lead time: <strong className="text-slate-700">{provBackup.leadTimeDias || '3-5'}d</strong> | Rating: ⭐ {provBackup.calificacion || 5}.0
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 🔵 FEATURE D: SCORECARD AUTOMÁTICO 360° */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Award className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Scorecards de Desempeño 360° (Odoo + Requisiciones)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Evaluación ponderada en tiempo real: Cumplimiento de Lead Time (35%), Competitividad de Precio (35%), Calidad/Aprobación (20%) y Servicio (10%).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onActualizarVentanaScorecards && (
              <Button
                type="button"
                variant="outline"
                onClick={onActualizarVentanaScorecards}
                disabled={cargandoVentanaScorecards || guardandoScorecards}
                className="font-bold text-xs gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoVentanaScorecards ? 'animate-spin' : ''}`} />
                {cargandoVentanaScorecards ? 'Cargando…' : 'Actualizar scorecards (12 meses)'}
              </Button>
            )}
            <Button
              onClick={onGenerarScorecards}
              disabled={guardandoScorecards || cargandoVentanaScorecards}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-2 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${guardandoScorecards ? 'animate-spin' : ''}`} />
              {guardandoScorecards ? 'Guardando...' : 'Persistir Scorecards en DB'}
            </Button>
          </div>
        </div>

        {scorecards.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
            <Award className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">
              Presiona &quot;Persistir Scorecards en DB&quot; para generar y sincronizar las métricas automáticas desde Odoo y órdenes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <TableRow>
                  <TableHead className="p-3">Proveedor</TableHead>
                  <TableHead className="p-3 text-center">Órdenes Totales</TableHead>
                  <TableHead className="p-3 text-center">Ratio Aprobación</TableHead>
                  <TableHead className="p-3 text-center">Lead Time Score</TableHead>
                  <TableHead className="p-3 text-center">Score General</TableHead>
                  <TableHead className="p-3">Observaciones / Fortalezas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 font-medium text-slate-700">
                {scorecards.map((sc, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="p-3 font-bold text-slate-900">
                      {sc.proveedorNombre}
                    </TableCell>

                    <TableCell className="p-3 text-center font-mono">
                      {sc.totalOrdenes} ({sc.ordenesAprobadas} aprobadas)
                    </TableCell>

                    <TableCell className="p-3 text-center">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        {((sc.ordenesAprobadas / Math.max(1, sc.totalOrdenes)) * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>

                    <TableCell className="p-3 text-center font-bold text-sky-700">
                      ⏱️ {sc.scoreCalidad.toFixed(1)} / 5.0
                    </TableCell>

                    <TableCell className="p-3 text-center font-bold text-amber-600 text-sm">
                      ⭐ {sc.promedioGeneral.toFixed(1)}
                    </TableCell>

                    <TableCell className="p-3 text-slate-500 text-[11px]">
                      {sc.evaluacionPayload.fortalezas.join(', ') || 'Desempeño estable'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

    </div>
  )
}
