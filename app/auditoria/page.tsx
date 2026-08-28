'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AccionAuditoria } from '@/lib/auditoria'
import AuthGuard from '@/app/AuthGuard'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleTabs from '@/components/layout/ModuleTabs'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  RefreshCw,
  UserCheck,
  Layers,
  Tag,
  Copy,
  User,
  Folder,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  BarChart3,
  Calendar,
  Eye,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { descargarCSVAuditoria, exportarExcelAuditoria } from '@/lib/auditoria-export'

interface LogAuditoria {
  id: string
  emailUsuario?: string
  accion?: AccionAuditoria | string
  coleccion?: string
  idDoc?: string
  resumen?: string
  fechaHora?: Timestamp
}

type RangoTemporal = 'hoy' | '7d' | '30d' | 'todos'

function badgeAccionClass(accion: string | undefined): string {
  if (accion === 'CREAR') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (accion === 'EDITAR') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (accion === 'BORRAR') return 'border-rose-200 bg-rose-50 text-rose-800'
  return 'border-border bg-muted text-muted-foreground'
}

function ModalDetalleAuditoria({
  log,
  onCerrar,
}: {
  log: LogAuditoria
  onCerrar: () => void
}) {
  const fechaTexto = log.fechaHora?.toDate
    ? log.fechaHora.toDate().toLocaleString('es-MX', {
        dateStyle: 'full',
        timeStyle: 'medium',
      })
    : 'Fecha no disponible'

  return (
    <Dialog open onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span>Detalle de Evento de Auditoría</span>
          </DialogTitle>
          <DialogDescription>Registro inmutable de trazabilidad</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">Acción</p>
              <span
                className={`mt-1 inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${badgeAccionClass(
                  log.accion
                )}`}
              >
                {log.accion}
              </span>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                Colección / Sección
              </p>
              <p className="mt-1 font-mono font-semibold text-foreground">{log.coleccion || '—'}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">Usuario</p>
              <p className="mt-1 font-semibold text-foreground break-all">{log.emailUsuario || '—'}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">Fecha y Hora</p>
              <p className="mt-1 text-foreground">{fechaTexto}</p>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                ID de Documento
              </label>
              {log.idDoc && (
                <button
                  type="button"
                  onClick={() => void copiarAlPortapapeles(log.idDoc!, 'ID copiado')}
                  className="cursor-pointer font-mono text-[11px] font-bold text-primary hover:underline"
                >
                  Copiar ID
                </button>
              )}
            </div>
            <code className="block w-full rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground select-all">
              {log.idDoc || '—'}
            </code>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
              Resumen de la Operación
            </label>
            <div className="rounded-md border border-border bg-card p-3 text-foreground select-text">
              {log.resumen || 'Sin resumen registrado'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VistaMetricasAuditoria({ logs }: { logs: LogAuditoria[] }) {
  const metricas = useMemo(() => {
    let creaciones = 0
    let ediciones = 0
    let borrados = 0
    const porUsuario = new Map<string, number>()
    const porColeccion = new Map<string, number>()

    logs.forEach((l) => {
      if (l.accion === 'CREAR') creaciones++
      else if (l.accion === 'EDITAR') ediciones++
      else if (l.accion === 'BORRAR') borrados++

      if (l.emailUsuario) {
        porUsuario.set(l.emailUsuario, (porUsuario.get(l.emailUsuario) ?? 0) + 1)
      }
      if (l.coleccion) {
        porColeccion.set(l.coleccion, (porColeccion.get(l.coleccion) ?? 0) + 1)
      }
    })

    const topUsuarios = Array.from(porUsuario.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topColecciones = Array.from(porColeccion.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return {
      creaciones,
      ediciones,
      borrados,
      topUsuarios,
      topColecciones,
      total: logs.length,
    }
  }, [logs])

  const pctCrear = metricas.total > 0 ? Math.round((metricas.creaciones / metricas.total) * 100) : 0
  const pctEditar = metricas.total > 0 ? Math.round((metricas.ediciones / metricas.total) * 100) : 0
  const pctBorrar = metricas.total > 0 ? Math.round((metricas.borrados / metricas.total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Distribución por acción */}
        <ModuleSurface className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" />
            <span>Distribución de Operaciones</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold text-emerald-700">Creaciones (CREAR)</span>
                <span className="font-mono text-foreground">{metricas.creaciones} ({pctCrear}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-emerald-500" style={{ width: `${pctCrear}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold text-sky-700">Modificaciones (EDITAR)</span>
                <span className="font-mono text-foreground">{metricas.ediciones} ({pctEditar}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-sky-500" style={{ width: `${pctEditar}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between">
                <span className="font-semibold text-rose-700">Eliminaciones (BORRAR)</span>
                <span className="font-mono text-foreground">{metricas.borrados} ({pctBorrar}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-rose-500" style={{ width: `${pctBorrar}%` }} />
              </div>
            </div>
          </div>
        </ModuleSurface>

        {/* Top Colecciones */}
        <ModuleSurface className="space-y-3 p-4">
          <h3 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Folder className="h-4 w-4 text-primary" />
            <span>Secciones con Mayor Movimiento</span>
          </h3>

          <div className="space-y-2 text-xs">
            {metricas.topColecciones.map(([col, cant]) => {
              const pct = Math.round((cant / metricas.total) * 100)
              return (
                <div key={col} className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="font-medium text-foreground">{col}</span>
                    <span className="text-muted-foreground">{cant} eventos ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ModuleSurface>
      </div>

      {/* Top Usuarios */}
      <ModuleSurface className="p-4">
        <h3 className="mb-3 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <User className="h-4 w-4 text-primary" />
          <span>Top Usuarios Más Activos</span>
        </h3>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {metricas.topUsuarios.map(([u, cant], idx) => (
            <div
              key={u}
              className="rounded-lg border border-border/70 bg-card p-3 text-xs"
            >
              <span className="font-mono text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
              <p className="mt-1 truncate font-semibold text-foreground" title={u}>
                {u}
              </p>
              <p className="mt-1 font-mono text-xs font-bold text-primary">{cant} registros</p>
            </div>
          ))}
        </div>
      </ModuleSurface>
    </div>
  )
}

function TablaAuditoria({
  logs,
  cargando,
  errorLogs,
  onReintentar,
  onVerDetalle,
  onFiltrarPorUsuario,
  onFiltrarPorColeccion,
}: {
  logs: LogAuditoria[]
  cargando: boolean
  errorLogs: string | null
  onReintentar: () => void
  onVerDetalle: (log: LogAuditoria) => void
  onFiltrarPorUsuario: (u: string) => void
  onFiltrarPorColeccion: (c: string) => void
}) {
  return (
    <>
      {/* Móvil */}
      <ModuleSurface className="divide-y divide-border md:hidden">
        {cargando ? (
          <p className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            Cargando bitácora...
          </p>
        ) : errorLogs ? (
          <div className="space-y-2 px-4 py-6 text-center font-mono text-xs text-destructive">
            <p>{errorLogs}</p>
            <button
              type="button"
              onClick={onReintentar}
              className="cursor-pointer font-semibold underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        ) : logs.length === 0 ? (
          <ModuleEmptyState
            icon={Layers}
            title="Sin registros"
            description="No hay registros que coincidan con los filtros."
            className="border-0"
          />
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              onClick={() => onVerDetalle(log)}
              className="cursor-pointer space-y-1.5 p-3.5 font-sans text-xs transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="break-all font-semibold text-foreground">{log.emailUsuario}</span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${badgeAccionClass(
                    log.accion
                  )}`}
                >
                  {log.accion}
                </span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                {log.fechaHora?.toDate ? log.fechaHora.toDate().toLocaleString('es-MX') : ''}
                {log.coleccion ? ` · ${log.coleccion}` : ''}
                {log.idDoc ? ` · ${log.idDoc}` : ''}
              </p>
              {log.resumen && <p className="text-foreground">{log.resumen}</p>}
            </div>
          ))
        )}
      </ModuleSurface>

      {/* Escritorio */}
      <ModuleSurface className="hidden md:block">
        <Table className="text-left text-xs">
          <TableHeader className="border-b border-border bg-muted font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            <TableRow>
              <TableHead className="px-3.5 py-2.5">Fecha y Hora</TableHead>
              <TableHead className="px-3.5 py-2.5">Usuario</TableHead>
              <TableHead className="px-3.5 py-2.5">Acción</TableHead>
              <TableHead className="px-3.5 py-2.5">Colección / Sección</TableHead>
              <TableHead className="px-3.5 py-2.5">ID Doc</TableHead>
              <TableHead className="px-3.5 py-2.5">Resumen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {cargando ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-4 py-6 text-center font-mono text-xs text-muted-foreground"
                >
                  Cargando bitácora...
                </TableCell>
              </TableRow>
            ) : errorLogs ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-4 py-6 text-center font-mono text-xs text-destructive"
                >
                  <p>{errorLogs}</p>
                  <button
                    type="button"
                    onClick={onReintentar}
                    className="mt-1 cursor-pointer font-semibold underline hover:no-underline"
                  >
                    Reintentar
                  </button>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <ModuleEmptyState
                    icon={Layers}
                    title="Sin registros"
                    description="No hay registros que coincidan con los filtros."
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const fechaTexto = log.fechaHora?.toDate
                  ? log.fechaHora.toDate().toLocaleString('es-MX')
                  : ''
                return (
                  <ContextMenu key={log.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        onClick={() => onVerDetalle(log)}
                        className="cursor-pointer font-sans select-none hover:bg-muted/50"
                      >
                        <TableCell className="px-3.5 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {fechaTexto}
                        </TableCell>
                        <TableCell className="px-3.5 py-2 font-semibold text-foreground">
                          {log.emailUsuario}
                        </TableCell>
                        <TableCell className="px-3.5 py-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${badgeAccionClass(
                              log.accion
                            )}`}
                          >
                            {log.accion}
                          </span>
                        </TableCell>
                        <TableCell className="px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
                          {log.coleccion}
                        </TableCell>
                        <TableCell className="px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
                          {log.idDoc}
                        </TableCell>
                        <TableCell
                          className="max-w-md truncate px-3.5 py-2 text-foreground"
                          title={log.resumen}
                        >
                          {log.resumen}
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => onVerDetalle(log)}>
                        <Eye className="text-primary" />
                        <span>Ver detalle completo</span>
                        <ContextMenuShortcut>↵</ContextMenuShortcut>
                      </ContextMenuItem>

                      {log.emailUsuario && (
                        <ContextMenuItem onClick={() => onFiltrarPorUsuario(log.emailUsuario!)}>
                          <User className="text-primary" />
                          <span>Filtrar por este usuario</span>
                        </ContextMenuItem>
                      )}

                      {log.coleccion && (
                        <ContextMenuItem onClick={() => onFiltrarPorColeccion(log.coleccion!)}>
                          <Folder className="text-amber-600" />
                          <span>Filtrar por sección ({log.coleccion})</span>
                        </ContextMenuItem>
                      )}

                      <ContextMenuSeparator />

                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Copy className="text-muted-foreground" />
                          <span>Copiar información</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          {log.idDoc && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(log.idDoc!, 'ID de documento copiado')
                              }}
                            >
                              <span>ID Doc ({log.idDoc})</span>
                            </ContextMenuItem>
                          )}
                          {log.resumen && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(log.resumen!, 'Resumen copiado')
                              }}
                            >
                              <span>Resumen</span>
                            </ContextMenuItem>
                          )}
                          {log.emailUsuario && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(log.emailUsuario!, 'Usuario copiado')
                              }}
                            >
                              <span>Usuario ({log.emailUsuario})</span>
                            </ContextMenuItem>
                          )}
                          {fechaTexto && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(fechaTexto, 'Fecha y hora copiada')
                              }}
                            >
                              <span>Fecha y hora</span>
                            </ContextMenuItem>
                          )}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })
            )}
          </TableBody>
        </Table>
      </ModuleSurface>
    </>
  )
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorLogs, setErrorLogs] = useState<string | null>(null)

  const [tabActual, setTabActual] = useState<'eventos' | 'criticas' | 'metricas'>('eventos')
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<LogAuditoria | null>(null)

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>('TODOS')
  const [filtroColeccion, setFiltroColeccion] = useState<string>('TODAS')
  const [filtroAccion, setFiltroAccion] = useState<string>('TODAS')
  const [filtroRango, setFiltroRango] = useState<RangoTemporal>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [limiteLogs, setLimiteLogs] = useState<number>(300)
  const [timestampActual] = useState(() => Date.now())

  async function fetchLogs() {
    setCargando(true)
    setErrorLogs(null)
    try {
      const q = query(collection(db, 'auditoria'), orderBy('fechaHora', 'desc'), limit(limiteLogs))
      const snapshot = await getDocs(q)
      setLogs(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            emailUsuario: typeof data.emailUsuario === 'string' ? data.emailUsuario : undefined,
            accion: typeof data.accion === 'string' ? data.accion : undefined,
            coleccion: typeof data.coleccion === 'string' ? data.coleccion : undefined,
            idDoc: typeof data.idDoc === 'string' ? data.idDoc : undefined,
            resumen: typeof data.resumen === 'string' ? data.resumen : undefined,
            fechaHora: data.fechaHora as Timestamp | undefined,
          }
        })
      )
    } catch (error) {
      console.error('Error fetching logs:', error)
      setErrorLogs('No se pudo cargar la bitácora de auditoría. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limiteLogs])

  // Lista única de usuarios y colecciones registradas
  const usuariosUnicos = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((l) => {
      if (l.emailUsuario) set.add(l.emailUsuario)
    })
    return Array.from(set).sort()
  }, [logs])

  const coleccionesUnicas = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((l) => {
      if (l.coleccion) set.add(l.coleccion)
    })
    return Array.from(set).sort()
  }, [logs])

  // Logs filtrados
  const logsFiltrados = useMemo(() => {
    const ahora = timestampActual
    const unDia = 24 * 60 * 60 * 1000
    const sieteDias = 7 * unDia
    const treintaDias = 30 * unDia

    return logs.filter((log) => {
      if (filtroUsuario !== 'TODOS' && log.emailUsuario?.toLowerCase() !== filtroUsuario.toLowerCase()) {
        return false
      }
      if (filtroColeccion !== 'TODAS' && log.coleccion !== filtroColeccion) {
        return false
      }
      if (filtroAccion !== 'TODAS' && log.accion !== filtroAccion) {
        return false
      }

      // Filtro temporal
      if (filtroRango !== 'todos' && log.fechaHora?.toDate) {
        const fechaMs = log.fechaHora.toDate().getTime()
        const diff = ahora - fechaMs
        if (filtroRango === 'hoy' && diff > unDia) return false
        if (filtroRango === '7d' && diff > sieteDias) return false
        if (filtroRango === '30d' && diff > treintaDias) return false
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const matchUser = log.emailUsuario?.toLowerCase().includes(q)
        const matchCol = log.coleccion?.toLowerCase().includes(q)
        const matchId = log.idDoc?.toLowerCase().includes(q)
        const matchResumen = log.resumen?.toLowerCase().includes(q)
        if (!matchUser && !matchCol && !matchId && !matchResumen) {
          return false
        }
      }
      return true
    })
  }, [logs, filtroUsuario, filtroColeccion, filtroAccion, filtroRango, busqueda, timestampActual])

  // Operaciones críticas: sólo BORRAR o cambios sensibles
  const logsCriticos = useMemo(() => {
    return logs.filter(
      (log) =>
        log.accion === 'BORRAR' ||
        log.coleccion === 'usuarios' ||
        log.coleccion === 'gafetes' ||
        log.coleccion === 'config_sistema'
    )
  }, [logs])

  const limpiarFiltros = () => {
    setFiltroUsuario('TODOS')
    setFiltroColeccion('TODAS')
    setFiltroAccion('TODAS')
    setFiltroRango('todos')
    setBusqueda('')
  }

  const hayFiltrosActivos =
    filtroUsuario !== 'TODOS' ||
    filtroColeccion !== 'TODAS' ||
    filtroAccion !== 'TODAS' ||
    filtroRango !== 'todos' ||
    busqueda !== ''

  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Bitácora de auditoría"
          badge="Acceso restringido"
          icon={Layers}
          description="Registro inmutable de operaciones, modificaciones y borrados realizados por todos los usuarios."
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => descargarCSVAuditoria(logsFiltrados)}
              >
                <Download data-icon="inline-start" />
                Exportar CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void exportarExcelAuditoria(logsFiltrados)}
              >
                <FileSpreadsheet data-icon="inline-start" />
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={cargando}
              >
                <RefreshCw className={cargando ? 'animate-spin' : undefined} data-icon="inline-start" />
                Actualizar
              </Button>
              <select
                value={limiteLogs}
                onChange={(e) => setLimiteLogs(Number(e.target.value))}
                className="rounded-lg border border-input bg-card px-2 py-1.5 text-xs font-medium text-foreground focus:ring-1 focus:ring-ring"
              >
                <option value={100}>100 más recientes</option>
                <option value={300}>300 más recientes</option>
                <option value={500}>500 más recientes</option>
                <option value={1000}>1000 más recientes</option>
              </select>
            </div>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <ModuleSurface className="p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Eventos Cargados
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">{logs.length}</p>
          </ModuleSurface>
          <ModuleSurface className="p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Usuarios Activos
            </p>
            <p className="mt-1 text-xl font-bold text-primary">{usuariosUnicos.length}</p>
          </ModuleSurface>
          <ModuleSurface className="p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Secciones Auditadas
            </p>
            <p className="mt-1 text-xl font-bold text-foreground">{coleccionesUnicas.length}</p>
          </ModuleSurface>
          <ModuleSurface className="p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Operaciones Críticas
            </p>
            <p className="mt-1 text-xl font-bold text-rose-600">{logsCriticos.length}</p>
          </ModuleSurface>
        </div>

        {/* Pestañas */}
        <ModuleTabs
          value={tabActual}
          onValueChange={(val) => setTabActual(val as 'eventos' | 'criticas' | 'metricas')}
          items={[
            {
              value: 'eventos',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Registro de Eventos ({logsFiltrados.length})</span>
                </span>
              ),
              content: (
                <div className="space-y-3">
                  {/* Barra de Filtros y Búsqueda */}
                  <ModuleSurface className="space-y-3 p-3.5">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
                      {/* Buscador */}
                      <div className="relative">
                        <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Buscar resumen, id, usuario..."
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      {/* Filtro Usuario */}
                      <div className="relative">
                        <UserCheck className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={filtroUsuario}
                          onChange={(e) => setFiltroUsuario(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                        >
                          <option value="TODOS">Todos los usuarios ({usuariosUnicos.length})</option>
                          {usuariosUnicos.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro Sección / Colección */}
                      <div className="relative">
                        <Layers className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={filtroColeccion}
                          onChange={(e) => setFiltroColeccion(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 font-mono text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                        >
                          <option value="TODAS">Todas las secciones ({coleccionesUnicas.length})</option>
                          {coleccionesUnicas.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro Rango Fecha */}
                      <div className="relative">
                        <Calendar className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={filtroRango}
                          onChange={(e) => setFiltroRango(e.target.value as RangoTemporal)}
                          className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-ring"
                        >
                          <option value="todos">Cualquier fecha</option>
                          <option value="hoy">Hoy (últimas 24h)</option>
                          <option value="7d">Últimos 7 días</option>
                          <option value="30d">Últimos 30 días</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-[11px] text-muted-foreground">Acción:</span>
                        <ModuleFilterChips
                          ariaLabel="Filtrar por acción"
                          value={filtroAccion}
                          onValueChange={(val) => setFiltroAccion(val)}
                          options={[
                            { value: 'TODAS', label: 'Todas' },
                            { value: 'CREAR', label: 'CREAR' },
                            { value: 'EDITAR', label: 'EDITAR' },
                            { value: 'BORRAR', label: 'BORRAR' },
                          ]}
                        />
                      </div>

                      {hayFiltrosActivos && (
                        <button
                          type="button"
                          onClick={limpiarFiltros}
                          className="cursor-pointer text-xs font-medium text-destructive hover:underline"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </ModuleSurface>

                  <TablaAuditoria
                    logs={logsFiltrados}
                    cargando={cargando}
                    errorLogs={errorLogs}
                    onReintentar={fetchLogs}
                    onVerDetalle={(log) => setDetalleSeleccionado(log)}
                    onFiltrarPorUsuario={(u) => setFiltroUsuario(u)}
                    onFiltrarPorColeccion={(c) => setFiltroColeccion(c)}
                  />
                </div>
              ),
            },
            {
              value: 'criticas',
              label: (
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Operaciones Críticas ({logsCriticos.length})</span>
                </span>
              ),
              content: (
                <div className="space-y-3">
                  <ModuleSurface className="border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-900">
                    <p className="font-semibold">Supervisión de Acciones Sensibles</p>
                    <p className="text-[11px] text-rose-700">
                      Muestra eliminaciones definitivas y modificaciones de permisos/usuarios.
                    </p>
                  </ModuleSurface>

                  <TablaAuditoria
                    logs={logsCriticos}
                    cargando={cargando}
                    errorLogs={errorLogs}
                    onReintentar={fetchLogs}
                    onVerDetalle={(log) => setDetalleSeleccionado(log)}
                    onFiltrarPorUsuario={(u) => setFiltroUsuario(u)}
                    onFiltrarPorColeccion={(c) => setFiltroColeccion(c)}
                  />
                </div>
              ),
            },
            {
              value: 'metricas',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  <span>Métricas & Actividad</span>
                </span>
              ),
              content: <VistaMetricasAuditoria logs={logs} />,
            },
          ]}
        />

        {detalleSeleccionado && (
          <ModalDetalleAuditoria
            log={detalleSeleccionado}
            onCerrar={() => setDetalleSeleccionado(null)}
          />
        )}
      </PageShell>
    </AuthGuard>
  )
}
