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
import ModuleSurface from '@/components/layout/ModuleSurface'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Filter, RefreshCw, UserCheck, Layers, Tag, Copy, User, Folder } from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'

interface LogAuditoria {
  id: string
  emailUsuario?: string
  accion?: AccionAuditoria | string
  coleccion?: string
  idDoc?: string
  resumen?: string
  fechaHora?: Timestamp
}

function badgeAccionClass(accion: string | undefined): string {
  if (accion === 'CREAR') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (accion === 'EDITAR') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (accion === 'BORRAR') return 'border-rose-200 bg-rose-50 text-rose-800'
  return 'border-border bg-muted text-muted-foreground'
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorLogs, setErrorLogs] = useState<string | null>(null)

  // Filtros
  const [filtroUsuario, setFiltroUsuario] = useState<string>('TODOS')
  const [filtroColeccion, setFiltroColeccion] = useState<string>('TODAS')
  const [filtroAccion, setFiltroAccion] = useState<string>('TODAS')
  const [busqueda, setBusqueda] = useState<string>('')
  const [limiteLogs, setLimiteLogs] = useState<number>(300)

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

  // Obtener lista única de usuarios y colecciones registradas
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
  }, [logs, filtroUsuario, filtroColeccion, filtroAccion, busqueda])

  const limpiarFiltros = () => {
    setFiltroUsuario('TODOS')
    setFiltroColeccion('TODAS')
    setFiltroAccion('TODAS')
    setBusqueda('')
  }

  const hayFiltrosActivos =
    filtroUsuario !== 'TODOS' ||
    filtroColeccion !== 'TODAS' ||
    filtroAccion !== 'TODAS' ||
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
            <>
              <Button type="button" variant="outline" size="sm" onClick={fetchLogs} disabled={cargando}>
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
              </select>
            </>
          }
        />

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

            {/* Filtro Acción */}
            <div className="relative">
              <Tag className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={filtroAccion}
                onChange={(e) => setFiltroAccion(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-ring"
              >
                <option value="TODAS">Todas las acciones</option>
                <option value="CREAR">CREAR</option>
                <option value="EDITAR">EDITAR</option>
                <option value="BORRAR">BORRAR</option>
              </select>
            </div>
          </div>

          {/* Contador de resultados y botón limpiar */}
          <div className="flex items-center justify-between border-t border-border pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Mostrando <strong className="text-foreground">{logsFiltrados.length}</strong> de{' '}
                <strong className="text-foreground">{logs.length}</strong> eventos registrados
              </span>
              {hayFiltrosActivos && (
                <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] text-rose-700">
                  <Filter className="h-3 w-3" /> Filtros aplicados
                </span>
              )}
            </div>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs font-medium text-destructive hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </ModuleSurface>

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
                onClick={fetchLogs}
                className="font-semibold underline hover:no-underline"
              >
                Reintentar
              </button>
            </div>
          ) : logsFiltrados.length === 0 ? (
            <ModuleEmptyState
              icon={Layers}
              title="Sin registros"
              description="No hay registros que coincidan con los filtros."
              className="border-0"
            />
          ) : (
            logsFiltrados.map((log) => (
              <div key={log.id} className="space-y-1.5 p-3.5 font-sans text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="break-all font-semibold text-foreground">{log.emailUsuario}</span>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${badgeAccionClass(log.accion)}`}
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
                      onClick={fetchLogs}
                      className="mt-1 font-semibold underline hover:no-underline"
                    >
                      Reintentar
                    </button>
                  </TableCell>
                </TableRow>
              ) : logsFiltrados.length === 0 ? (
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
                logsFiltrados.map((log) => {
                  const fechaTexto = log.fechaHora?.toDate
                    ? log.fechaHora.toDate().toLocaleString('es-MX')
                    : ''
                  return (
                    <ContextMenu key={log.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-pointer font-sans select-none hover:bg-muted/50">
                          <TableCell className="px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
                            {fechaTexto}
                          </TableCell>
                          <TableCell className="px-3.5 py-2 font-semibold text-foreground">
                            {log.emailUsuario}
                          </TableCell>
                          <TableCell className="px-3.5 py-2">
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${badgeAccionClass(log.accion)}`}
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
                        {log.emailUsuario && (
                          <ContextMenuItem onClick={() => setFiltroUsuario(log.emailUsuario!)}>
                            <User className="text-primary" />
                            <span>Filtrar por este usuario</span>
                            <ContextMenuShortcut>↵</ContextMenuShortcut>
                          </ContextMenuItem>
                        )}

                        {log.coleccion && (
                          <ContextMenuItem onClick={() => setFiltroColeccion(log.coleccion!)}>
                            <Folder className="text-amber-600" />
                            <span>Filtrar por colección ({log.coleccion})</span>
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
      </PageShell>
    </AuthGuard>
  )
}
