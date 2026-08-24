'use client'

import {
  Award,
  CheckCircle2,
  Clock,
  RefreshCw,
  Star,
  Zap,
  Layers,
} from 'lucide-react'
import ModuleSurface from '@/components/layout/ModuleSurface'
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
      {/* Matriz de proveedor primario vs backup */}
      <ModuleSurface className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-50 text-primary border border-sky-200">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Matriz de Cobertura: Proveedor Primario vs Backup
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
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
                className="p-4 rounded-xl bg-muted/40 border border-border space-y-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {catItem.titulo}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
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
                      className="w-full bg-card border border-input rounded-lg p-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="">Seleccionar primario...</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.pais === 'Estados Unidos' ? 'USA' : 'MX'})
                        </option>
                      ))}
                    </select>
                    {provPrimario && (
                      <div className="text-[10px] text-muted-foreground">
                        Lead time: <strong className="text-foreground">{provPrimario.leadTimeDias || '3-5'}d</strong> | Rating: {provPrimario.calificacion || 5}.0
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
                      className="w-full bg-card border border-input rounded-lg p-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="">Seleccionar backup...</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({p.pais === 'Estados Unidos' ? 'USA' : 'MX'})
                        </option>
                      ))}
                    </select>
                    {provBackup && (
                      <div className="text-[10px] text-muted-foreground">
                        Lead time: <strong className="text-foreground">{provBackup.leadTimeDias || '3-5'}d</strong> | Rating: {provBackup.calificacion || 5}.0
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ModuleSurface>

      {/* Scorecard automático 360° */}
      <ModuleSurface className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <Award className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Scorecards de Desempeño 360° (Odoo + Requisiciones)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
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
          <div className="p-8 text-center bg-muted/40 rounded-xl space-y-2 border border-border">
            <Award className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">
              Presiona &quot;Persistir Scorecards en DB&quot; para generar y sincronizar las métricas automáticas desde Odoo y órdenes.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-muted/50 border-b border-border font-bold uppercase tracking-wider text-muted-foreground">
                <TableRow>
                  <TableHead className="p-3">Proveedor</TableHead>
                  <TableHead className="p-3 text-center">Órdenes Totales</TableHead>
                  <TableHead className="p-3 text-center">Ratio Aprobación</TableHead>
                  <TableHead className="p-3 text-center">Lead Time Score</TableHead>
                  <TableHead className="p-3 text-center">Score General</TableHead>
                  <TableHead className="p-3">Observaciones / Fortalezas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border font-medium text-foreground">
                {scorecards.map((sc, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="p-3 font-bold text-foreground">
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
                      <span className="inline-flex items-center justify-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {sc.scoreCalidad.toFixed(1)} / 5.0
                      </span>
                    </TableCell>

                    <TableCell className="p-3 text-center font-bold text-amber-600 text-sm">
                      <span className="inline-flex items-center justify-center gap-1">
                        <Star className="h-3.5 w-3.5" aria-hidden />
                        {sc.promedioGeneral.toFixed(1)}
                      </span>
                    </TableCell>

                    <TableCell className="p-3 text-muted-foreground text-[11px]">
                      {sc.evaluacionPayload.fortalezas.join(', ') || 'Desempeño estable'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleSurface>

    </div>
  )
}
