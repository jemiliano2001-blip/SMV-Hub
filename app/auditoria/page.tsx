'use client'

import { useEffect, useState, useMemo } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import AuthGuard from '@/app/AuthGuard'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Filter, RefreshCw, UserCheck, Layers, Tag } from 'lucide-react'

export default function AuditoriaPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([])
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
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
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
    logs.forEach(l => {
      if (l.emailUsuario) set.add(l.emailUsuario)
    })
    return Array.from(set).sort()
  }, [logs])

  const coleccionesUnicas = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(l => {
      if (l.coleccion) set.add(l.coleccion)
    })
    return Array.from(set).sort()
  }, [logs])

  // Logs filtrados
  const logsFiltrados = useMemo(() => {
    return logs.filter(log => {
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

  const hayFiltrosActivos = filtroUsuario !== 'TODOS' || filtroColeccion !== 'TODAS' || filtroAccion !== 'TODAS' || busqueda !== ''

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
                </select>
              </>
            }
          />

          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              
              {/* Buscador */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar resumen, id, usuario..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 placeholder-slate-400"
                />
              </div>

              {/* Filtro Usuario */}
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <select
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white text-slate-700"
                >
                  <option value="TODOS">Todos los usuarios ({usuariosUnicos.length})</option>
                  {usuariosUnicos.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Sección / Colección */}
              <div className="relative">
                <Layers className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <select
                  value={filtroColeccion}
                  onChange={(e) => setFiltroColeccion(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white text-slate-700 font-mono"
                >
                  <option value="TODAS">Todas las secciones ({coleccionesUnicas.length})</option>
                  {coleccionesUnicas.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Acción */}
              <div className="relative">
                <Tag className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <select
                  value={filtroAccion}
                  onChange={(e) => setFiltroAccion(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500 bg-white text-slate-700"
                >
                  <option value="TODAS">Todas las acciones</option>
                  <option value="CREAR">CREAR</option>
                  <option value="EDITAR">EDITAR</option>
                  <option value="BORRAR">BORRAR</option>
                </select>
              </div>

            </div>

            {/* Contador de resultados y botón limpiar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>
                  Mostrando <strong>{logsFiltrados.length}</strong> de <strong>{logs.length}</strong> eventos registrados
                </span>
                {hayFiltrosActivos && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                    <Filter className="w-3 h-3" /> Filtros aplicados
                  </span>
                )}
              </div>
              {hayFiltrosActivos && (
                <button
                  onClick={limpiarFiltros}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Móvil */}
          <div className="md:hidden bg-white rounded-xl shadow-xs border border-slate-200 divide-y divide-slate-100">
            {cargando ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando bitácora...</p>
            ) : errorLogs ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-red-600 space-y-2">
                <p>{errorLogs}</p>
                <button onClick={fetchLogs} className="font-semibold underline hover:no-underline">Reintentar</button>
              </div>
            ) : logsFiltrados.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">No hay registros que coincidan con los filtros.</p>
            ) : (
              logsFiltrados.map((log) => (
                <div key={log.id} className="p-3.5 space-y-1.5 text-xs font-sans">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 break-all">{log.emailUsuario}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${
                        log.accion === 'CREAR'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : log.accion === 'EDITAR'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : log.accion === 'BORRAR'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {log.accion}
                    </span>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px]">
                    {log.fechaHora?.toDate ? log.fechaHora.toDate().toLocaleString('es-MX') : ''}
                    {log.coleccion ? ` · ${log.coleccion}` : ''}
                    {log.idDoc ? ` · ${log.idDoc}` : ''}
                  </p>
                  {log.resumen && <p className="text-slate-700">{log.resumen}</p>}
                </div>
              ))
            )}
          </div>

          {/* Escritorio */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <Table className="text-xs text-left">
                <TableHeader className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <TableRow>
                    <TableHead className="px-3.5 py-2.5">Fecha y Hora</TableHead>
                    <TableHead className="px-3.5 py-2.5">Usuario</TableHead>
                    <TableHead className="px-3.5 py-2.5">Acción</TableHead>
                    <TableHead className="px-3.5 py-2.5">Colección / Sección</TableHead>
                    <TableHead className="px-3.5 py-2.5">ID Doc</TableHead>
                    <TableHead className="px-3.5 py-2.5">Resumen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {cargando ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando bitácora...</TableCell>
                    </TableRow>
                  ) : errorLogs ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-xs font-mono text-red-600">
                        <p>{errorLogs}</p>
                        <button onClick={fetchLogs} className="mt-1 font-semibold underline hover:no-underline">Reintentar</button>
                      </TableCell>
                    </TableRow>
                  ) : logsFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-xs font-mono text-slate-500">No hay registros que coincidan con los filtros.</TableCell>
                    </TableRow>
                  ) : (
                    logsFiltrados.map(log => (
                      <TableRow key={log.id} className="hover:bg-slate-50 font-sans">
                        <TableCell className="px-3.5 py-2 text-slate-600 font-mono text-[11px]">
                          {log.fechaHora?.toDate ? log.fechaHora.toDate().toLocaleString('es-MX') : ''}
                        </TableCell>
                        <TableCell className="px-3.5 py-2 font-semibold text-slate-900">{log.emailUsuario}</TableCell>
                        <TableCell className="px-3.5 py-2">
                          <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded border ${
                            log.accion === 'CREAR' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            log.accion === 'EDITAR' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                            log.accion === 'BORRAR' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {log.accion}
                          </span>
                        </TableCell>
                        <TableCell className="px-3.5 py-2 text-slate-600 font-mono text-[11px]">{log.coleccion}</TableCell>
                        <TableCell className="px-3.5 py-2 text-slate-500 font-mono text-[11px]">{log.idDoc}</TableCell>
                        <TableCell className="px-3.5 py-2 text-slate-700 max-w-md truncate" title={log.resumen}>{log.resumen}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>

      </PageShell>
    </AuthGuard>
  )
}
