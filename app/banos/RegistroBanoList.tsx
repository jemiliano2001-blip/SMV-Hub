'use client'

import { useState, useRef, useMemo } from 'react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { calcularMinutos, useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { Bano, MotivoSolicitudBorradoBano, Operador, RegistroBano } from '@/lib/schemas'
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from '@/lib/format'
import { resolverOperadorActivo, resolverOperadorPorQR } from '@/lib/banos-captura'
import { MOTIVOS_SOLICITUD_BORRADO_BANO } from '@/lib/banos-solicitudes-borrado'
import { Plus, Trash2, Check, Search, Pencil, Clock, Copy, CheckCircle, QrCode, Sparkles, Printer } from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { LectorQR } from '@/components/LectorQR'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const BANOS: Bano[] = ['Baño #1', 'Baño #2', 'CNC', 'Automatizacion']

const AREA_COLORS: Record<string, string> = {
  taller: 'bg-blue-100 text-blue-700',
  diseno: 'bg-purple-100 text-purple-700',
  automatizacion: 'bg-emerald-100 text-emerald-700',
  cnc: 'bg-amber-100 text-amber-700',
  limpieza: 'bg-muted text-muted-foreground',
  administracion: 'bg-rose-100 text-rose-700',
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

interface RegistroBanoListProps {
  onIrAReporteDiario?: () => void
}

export default function RegistroBanoList({ onIrAReporteDiario }: RegistroBanoListProps = {}) {
  const { usuario } = useUsuario()
  const { esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const puedeEliminar = esSuperAdmin || authBypassActivo()

  const confirmar = useConfirmDialog()
  const mesActual = fechaHoyLocal().slice(0, 7)
  const {
    registros,
    loading: loadingBanos,
    error,
    fetchRegistros,
    registrarEntrada,
    registrarLlegada,
    actualizarHorario,
    borrarRegistro,
  } = useBanos(mesActual)
  const { activos: operadoresActivos, loading: loadingOps } = useOperadores()

  const [agregando, setAgregando] = useState(false)
  const [errorDuplicado, setErrorDuplicado] = useState<string | null>(null)
  const [errorCaptura, setErrorCaptura] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [bano, setBano] = useState<Bano>(() => {
    if (typeof window === 'undefined') return 'Baño #1'
    try {
      const guardado = localStorage.getItem('smv_bano_preferido') as Bano | null
      if (guardado && BANOS.includes(guardado)) return guardado
    } catch {
      // Ignorar
    }
    return 'Baño #1'
  })
  const [operador, setOperador] = useState('')
  const [indicadorHora, setIndicadorHora] = useState(() => new Date())
  const [isLectorQROpen, setIsLectorQROpen] = useState(false)
  const operadorInputRef = useRef<HTMLInputElement>(null)

  function handleSeleccionarBano(nuevoBano: Bano) {
    setBano(nuevoBano)
    setErrorCaptura(null)
    try {
      localStorage.setItem('smv_bano_preferido', nuevoBano)
    } catch {
      // Ignorar
    }
  }

  // Estado para modal de edición de horario
  const [editandoRegistro, setEditandoRegistro] = useState<RegistroBano | null>(null)
  const [editHoraEntrada, setEditHoraEntrada] = useState('')
  const [editHoraLlegada, setEditHoraLlegada] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // Estado para modal de solicitud de eliminación (almacén)
  const [solicitandoRegistro, setSolicitandoRegistro] = useState<RegistroBano | null>(null)
  const [motivoSolicitud, setMotivoSolicitud] = useState<MotivoSolicitudBorradoBano | null>(null)
  const [notaSolicitud, setNotaSolicitud] = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null)

  function abrirModalSolicitud(r: RegistroBano) {
    setSolicitandoRegistro(r)
    setMotivoSolicitud(null)
    setNotaSolicitud('')
    setErrorSolicitud(null)
  }

  async function handleEnviarSolicitud(e: React.FormEvent) {
    e.preventDefault()
    if (!solicitandoRegistro || !motivoSolicitud) return
    if (motivoSolicitud === 'otro' && !notaSolicitud.trim()) {
      setErrorSolicitud('Escribe una nota para el motivo "Otro".')
      return
    }

    setEnviandoSolicitud(true)
    setErrorSolicitud(null)
    try {
      const token = await usuario?.getIdToken()
      const res = await fetch('/api/banos/solicitudes-borrado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          registroId: solicitandoRegistro.id,
          motivo: motivoSolicitud,
          nota: notaSolicitud.trim() || undefined,
        }),
      })
      const data = await res.json() as { estado?: string; error?: string }
      if (!res.ok) {
        setErrorSolicitud(data.error || 'No se pudo enviar la solicitud.')
        return
      }
      if (data.estado === 'rechazada') {
        setMensajeExito('La IA rechazó la solicitud; el registro se conserva.')
      } else {
        setMensajeExito(
        data.estado === 'auto_aprobada'
          ? `Se eliminó automáticamente el registro de ${solicitandoRegistro.operador}.`
          : 'Solicitud enviada. Un súper admin la revisará pronto.'
        )
      }
      setSolicitandoRegistro(null)
    } catch (err) {
      console.error('Error enviando solicitud de borrado:', err)
      setErrorSolicitud('No se pudo enviar la solicitud. Intenta de nuevo.')
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  function abrirModalEditar(r: RegistroBano) {
    setEditandoRegistro(r)
    setEditHoraEntrada(r.horaEntrada)
    setEditHoraLlegada(r.horaLlegada || horaAhoraLocal())
    setErrorEdit(null)
  }

  async function handleGuardarHorario(e: React.FormEvent) {
    e.preventDefault()
    if (!editandoRegistro) return
    if (!editHoraEntrada || !editHoraLlegada) {
      setErrorEdit('Ingresa tanto la hora de entrada como la de llegada.')
      return
    }

    setGuardandoEdit(true)
    setErrorEdit(null)
    try {
      await actualizarHorario(editandoRegistro.id, editHoraEntrada, editHoraLlegada)
      const mins = calcularMinutos(editHoraEntrada, editHoraLlegada)
      setMensajeExito(
        `Horario de ${editandoRegistro.operador} actualizado a ${editHoraEntrada} - ${editHoraLlegada} (${mins} min)`
      )
      setEditandoRegistro(null)
    } catch (err) {
      console.error('Error guardando horario:', err)
      setErrorEdit('No se pudo actualizar el horario. Intenta de nuevo.')
    } finally {
      setGuardandoEdit(false)
    }
  }

  const fechaHoy = fechaHoyLocal()

  const yaEnCurso = operador
    ? registros.some((r) => r.fecha === fechaHoy && r.operador === operador.trim() && !r.horaLlegada)
    : false

  // Operadores más frecuentes de hoy / turno para 1-tap punch
  const operadoresFrecuentes = useMemo(() => {
    const nombresHoy = new Set(registros.filter((r) => r.fecha === fechaHoy).map((r) => r.operador))
    const frecuentes = operadoresActivos.filter((op) => nombresHoy.has(op.nombre))
    // Si hay pocos hoy, rellenar con los primeros operadores activos
    const restantes = operadoresActivos.filter((op) => !nombresHoy.has(op.nombre))
    return [...frecuentes, ...restantes].slice(0, 8)
  }, [registros, operadoresActivos, fechaHoy])

  async function registrarEntradaDirecta(op: Operador, banoDestino: Bano) {
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    if (registros.some((r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada)) {
      setErrorDuplicado(
        `${op.nombre} ya tiene un registro abierto hoy. Marca "Llegó" antes de registrar otro.`
      )
      toast.warning(`${op.nombre} ya está en el baño`, { description: 'Marca su llegada primero.' })
      return
    }

    const ahora = new Date()
    const fecha = fechaHoyLocal(ahora)
    const horaEntrada = horaAhoraLocal(ahora)

    setAgregando(true)
    try {
      await registrarEntrada({ fecha, operador: op.nombre, bano: banoDestino, horaEntrada })
      setMensajeExito(`${op.nombre} registrado — ${banoDestino}, ${horaEntrada}`)
      toast.success(`Entrada registrada: ${op.nombre}`, {
        description: `${banoDestino} a las ${horaEntrada}`,
      })
      setOperador('')
      setIndicadorHora(ahora)
      setTimeout(() => operadorInputRef.current?.focus(), 0)
    } catch (err) {
      console.error('Error registrando entrada:', err)
      setErrorCaptura('No se pudo registrar la entrada. Intenta de nuevo.')
      toast.error('Error al registrar entrada')
    } finally {
      setAgregando(false)
    }
  }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    if (!bano) {
      setErrorCaptura('Selecciona un baño primero')
      return
    }

    const op = resolverOperadorActivo(operador, operadoresActivos)
    if (!op) {
      setErrorCaptura('Operador no encontrado en el catálogo')
      return
    }

    await registrarEntradaDirecta(op, bano)
  }

  function handleQRScanned(payload: string) {
    const op = resolverOperadorPorQR(payload, operadoresActivos)
    if (!op) {
      toast.error('Gafete no reconocido', {
        description: `No se encontró operador activo para "${payload.slice(0, 30)}"`,
      })
      return
    }

    void registrarEntradaDirecta(op, bano)
  }

  async function handleLlegada(id: string, horaOriginal: string) {
    const horaLlegada = horaAhoraLocal()
    try {
      await registrarLlegada(id, horaLlegada, horaOriginal)
      toast.success('Llegada registrada', { description: `Hora: ${horaLlegada}` })
    } catch (err) {
      console.error('Error registrando llegada:', err)
      setErrorCaptura('No se pudo registrar la llegada. Intenta de nuevo.')
      toast.error('Error al registrar llegada')
    }
  }

  async function handleEliminar(id: string, op: string) {
    const aceptado = await confirmar({
      title: 'Eliminar registro de baño',
      description: `Se eliminará el registro de ${op}.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await borrarRegistro(id)
      toast.info('Registro eliminado')
    } catch (err) {
      console.error('Error eliminando registro:', err)
      toast.error('Error al eliminar registro')
    }
  }

  if (loadingBanos || loadingOps) {
    return <div className="animate-pulse h-64 bg-muted rounded-xl"></div>
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchRegistros} className="font-semibold underline hover:no-underline cursor-pointer">
          Reintentar
        </button>
      </div>
    )
  }

  const registrosHoy = registros.filter(r => r.fecha === fechaHoy)
  const enCursoTodos = registrosHoy.filter(r => !r.horaLlegada)
  const terminadosTodos = registrosHoy.filter(r => r.horaLlegada)

  const enCursoOrdenados = [...enCursoTodos].sort((a, b) =>
    b.horaEntrada.localeCompare(a.horaEntrada)
  )

  const filtro = busqueda.trim().toLowerCase()
  const enCurso = filtro ? enCursoOrdenados.filter(r => r.operador.toLowerCase().includes(filtro)) : enCursoOrdenados
  const terminados = filtro ? terminadosTodos.filter(r => r.operador.toLowerCase().includes(filtro)) : terminadosTodos

  const totalMinutos = terminadosTodos.reduce((acc, curr) => acc + (curr.tiempoMinutos || 0), 0)
  const promedio = terminadosTodos.length ? Math.round(totalMinutos / terminadosTodos.length) : 0
  const maxTiempo = terminadosTodos.length ? Math.max(...terminadosTodos.map(t => t.tiempoMinutos || 0)) : 0
  const personaMax = terminadosTodos.find(t => t.tiempoMinutos === maxTiempo)?.operador || ''

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── KPIs Rápidos de Hoy ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">En el baño ahora</p>
          <p className="mt-1 text-xl font-extrabold text-foreground flex items-center gap-2">
            <span>{enCursoTodos.length}</span>
            {enCursoTodos.length > 0 && <span className="size-2.5 rounded-full bg-amber-500 animate-ping" />}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Promedio hoy</p>
          <p className="mt-1 text-xl font-extrabold text-foreground">{promedio} <span className="text-xs font-normal text-muted-foreground">min</span></p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Máximo de hoy</p>
          <p className="mt-1 text-sm font-bold text-foreground truncate">
            {personaMax ? `${personaMax} (${maxTiempo} min)` : '--'}
          </p>
        </div>
      </div>

      {mensajeExito && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-emerald-800 text-sm animate-in fade-in-50">
          {mensajeExito}
        </div>
      )}
      {errorCaptura && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-700 text-sm animate-in fade-in-50">
          {errorCaptura}
        </div>
      )}
      {errorDuplicado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-700 text-sm animate-in fade-in-50">
          {errorDuplicado}
        </div>
      )}

      {/* ── Captura Rápida Turbo ── */}
      <ModuleSurface className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Registro Rápido de Entrada
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onIrAReporteDiario && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onIrAReporteDiario}
                className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer hover:bg-muted"
                title="Generar y consultar reporte diario en PDF"
              >
                <Printer className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Generar Reporte Diario</span>
                <span className="sm:hidden">Reporte PDF</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => setIsLectorQROpen(true)}
              className="h-8 px-3 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer shadow-xs rounded-xl"
            >
              <QrCode className="size-3.5" />
              <span>Escanear Gafete</span>
            </Button>
          </div>
        </div>

        {/* Selector Ergonómico de Baños */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground block">
            Baño / Ubicación
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {BANOS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => handleSeleccionarBano(b)}
                className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-xl border transition-all cursor-pointer select-none active:scale-95 text-center ${
                  bano === b
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-foreground border-border hover:border-primary/50'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Operadores Frecuentes / 1-Tap Punch */}
        <div className="space-y-2 pt-1 border-t border-border">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Operadores Frecuentes (1-Toque para registrar)
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {operadoresFrecuentes.map((op) => {
              const estaAdentro = registros.some((r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada)
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={agregando || estaAdentro}
                  onClick={() => void registrarEntradaDirecta(op, bano)}
                  title={estaAdentro ? `${op.nombre} ya está en el baño` : `Registrar entrada de ${op.nombre}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all shrink-0 cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    estaAdentro
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-border bg-card text-foreground hover:border-primary/60 hover:bg-sky-50/40 shadow-2xs'
                  }`}
                >
                  <span className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${AREA_COLORS[op.area || 'taller'] || 'bg-muted text-muted-foreground'}`}>
                    {getInitials(op.nombre)}
                  </span>
                  <span>{op.nombre.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Formulario con Datalist de Búsqueda */}
        <form onSubmit={handleAgregar} className="flex flex-wrap items-end gap-3 pt-1 border-t border-border">
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Buscar o escribir operador</label>
            <input
              list="operadores-list"
              ref={operadorInputRef}
              required
              placeholder="Escribe el nombre del operador…"
              value={operador}
              onChange={(e) => {
                setOperador(e.target.value)
                setErrorDuplicado(null)
                setErrorCaptura(null)
              }}
              className="w-full px-3.5 py-2 text-sm border border-input rounded-xl bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <datalist id="operadores-list">
              {operadoresActivos.map(op => (
                <option key={op.id} value={op.nombre} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatIndicadorCapturaBano(indicadorHora)}
            </p>
          </div>

          <button
            type="submit"
            disabled={agregando || yaEnCurso || !bano}
            title={
              yaEnCurso
                ? `${operador} ya tiene un registro abierto hoy`
                : !bano
                  ? 'Selecciona un baño primero'
                  : undefined
            }
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Registrar Entrada
          </button>
        </form>
      </ModuleSurface>

      {/* Modal de Escáner QR de Gafetes */}
      <LectorQR
        isOpen={isLectorQROpen}
        onClose={() => setIsLectorQROpen(false)}
        onScan={handleQRScanned}
        titulo="Escanear Gafete del Operador"
        subtitulo="Apunta la cámara al código QR de su gafete para registrar entrada instantánea"
      />

      {/* Barra de Filtro de Registros */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filtrar por operador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-input bg-card text-foreground rounded-xl focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── En el Baño Ahora ── */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>En el baño ahora</span>
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 font-mono font-bold">
              {enCurso.length}
            </span>
          </h3>

          {/* Vista móvil de tarjetas táctiles (para teléfonos) */}
          <div className="space-y-2.5 sm:hidden">
            {enCurso.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
                {filtro && enCursoTodos.length > 0 ? 'Sin coincidencias' : 'Nadie en el baño actualmente'}
              </div>
            ) : (
              enCurso.map((r) => {
                const mins = calcularMinutos(r.horaEntrada, horaAhoraLocal())
                const esLargo = mins >= 15
                const esMedio = mins >= 10 && mins < 15

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-muted text-muted-foreground'}`}>
                          {getInitials(r.operador)}
                        </div>
                        <p className="font-bold text-sm text-foreground truncate">{r.operador}</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{r.bano}</span>
                        <span>·</span>
                        <span>Entró: {r.horaEntrada}</span>
                        <span>·</span>
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          esLargo
                            ? 'bg-red-100 text-red-800 animate-pulse'
                            : esMedio
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {mins} min
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleLlegada(r.id, r.horaEntrada)}
                      className="shrink-0 h-11 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Check className="size-4" />
                      <span>Llegó</span>
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Vista de tabla para pantallas medianas/grandes */}
          <div className="hidden sm:block">
            <ModuleSurface>
              <Table className="text-xs">
                <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
                  <TableRow>
                    <TableHead className="px-4 py-2">Operador</TableHead>
                    <TableHead className="px-4 py-2">Baño</TableHead>
                    <TableHead className="px-4 py-2 w-20">Entrada</TableHead>
                    <TableHead className="px-4 py-2 w-28 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {enCurso.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        {filtro && enCursoTodos.length > 0 ? 'Sin coincidencias' : 'Nadie en el baño'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    enCurso.map((r) => (
                      <ContextMenu key={r.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow className="hover:bg-amber-50/50 cursor-pointer select-none" onDoubleClick={() => handleLlegada(r.id, r.horaEntrada)}>
                            <TableCell className="px-4 py-2 font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-muted text-muted-foreground'}`}>
                                  {getInitials(r.operador)}
                                </div>
                                {r.operador}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2 text-muted-foreground">{r.bano}</TableCell>
                            <TableCell className="px-4 py-2 text-foreground">{r.horaEntrada}</TableCell>
                            <TableCell className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => abrirModalEditar(r)}
                                  title="Editar hora de entrada"
                                  className="text-xs font-semibold text-primary bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleLlegada(r.id, r.horaEntrada)}
                                  className="text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Llegó
                                </button>
                                {!puedeEliminar && !!usuario?.uid && r.creadoPorUid === usuario.uid && (
                                  r.solicitudBorradoEstado === 'pendiente' ? (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                      Pendiente
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalSolicitud(r)}
                                      title="Solicitar eliminación (un súper admin la revisará)"
                                      className="text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      Solicitar eliminación
                                    </button>
                                  )
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-56">
                          <ContextMenuItem onClick={() => void handleLlegada(r.id, r.horaEntrada)}>
                            <CheckCircle className="text-emerald-600" />
                            <span>Marcar Llegada ahora</span>
                            <ContextMenuShortcut>↵</ContextMenuShortcut>
                          </ContextMenuItem>

                          <ContextMenuItem onClick={() => abrirModalEditar(r)}>
                            <Pencil className="text-sky-600" />
                            <span>Editar horario</span>
                          </ContextMenuItem>

                          <ContextMenuSeparator />

                          <ContextMenuItem
                            onClick={() => {
                              void copiarAlPortapapeles(r.operador, 'Nombre copiado', r.operador)
                            }}
                          >
                            <Copy className="text-muted-foreground" />
                            <span>Copiar nombre ({r.operador})</span>
                          </ContextMenuItem>

                          {puedeEliminar ? (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                className="text-rose-600"
                                onClick={() => handleEliminar(r.id, r.operador)}
                              >
                                <Trash2 className="text-rose-600" />
                                <span>Eliminar registro</span>
                              </ContextMenuItem>
                            </>
                          ) : (
                            !puedeEliminar && !!usuario?.uid && r.creadoPorUid === usuario.uid && r.solicitudBorradoEstado !== 'pendiente' && (
                              <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  className="text-amber-700"
                                  onClick={() => abrirModalSolicitud(r)}
                                >
                                  <Trash2 className="text-amber-600" />
                                  <span>Solicitar eliminación</span>
                                </ContextMenuItem>
                              </>
                            )
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    ))
                  )}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>
        </div>

        {/* ── Completados Hoy ── */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40"></span>
              <span>Completados hoy</span>
            </span>
            <span className="rounded-full bg-muted text-muted-foreground text-xs px-2.5 py-0.5 font-mono">
              {terminados.length}
            </span>
          </h3>
          <ModuleSurface>
            <Table className="text-xs">
              <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
                <TableRow>
                  <TableHead className="px-4 py-2">Operador</TableHead>
                  <TableHead className="px-4 py-2">Baño</TableHead>
                  <TableHead className="px-4 py-2 w-32">Horario</TableHead>
                  <TableHead className="px-4 py-2 w-20 text-right">Total</TableHead>
                  <TableHead className="px-4 py-2 w-16 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {terminados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                      {filtro && terminadosTodos.length > 0 ? 'Sin coincidencias' : 'No hay registros completados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  terminados.map((r) => (
                    <ContextMenu key={r.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="hover:bg-muted cursor-pointer select-none" onDoubleClick={() => abrirModalEditar(r)}>
                          <TableCell className="px-4 py-2 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-muted text-muted-foreground'}`}>
                                {getInitials(r.operador)}
                              </div>
                              {r.operador}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-muted-foreground text-xs">{r.bano}</TableCell>
                          <TableCell
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirModalEditar(r)
                            }}
                            className="px-4 py-2 text-muted-foreground text-xs tracking-tighter cursor-pointer hover:text-primary hover:underline"
                            title="Clic para editar horario"
                          >
                            {r.horaEntrada} - {r.horaLlegada}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right font-medium text-foreground">
                            {r.tiempoMinutos} m
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => abrirModalEditar(r)}
                                title="Editar hora que llegó / horario"
                                className="text-xs font-semibold text-primary bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" />
                                Editar
                              </button>
                              {puedeEliminar && (
                                <button
                                  type="button"
                                  onClick={() => handleEliminar(r.id, r.operador)}
                                  title="Eliminar registro (Solo Super Admin)"
                                  className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => abrirModalEditar(r)}>
                          <Pencil className="text-primary" />
                          <span>Editar horario ({r.horaEntrada} - {r.horaLlegada})</span>
                          <ContextMenuShortcut>↵</ContextMenuShortcut>
                        </ContextMenuItem>

                        <ContextMenuSeparator />

                        <ContextMenuItem
                          onClick={() => {
                            void copiarAlPortapapeles(r.operador, 'Nombre copiado', r.operador)
                          }}
                        >
                          <Copy className="text-muted-foreground" />
                          <span>Copiar nombre ({r.operador})</span>
                        </ContextMenuItem>

                        {puedeEliminar && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-rose-600"
                              onClick={() => handleEliminar(r.id, r.operador)}
                            >
                              <Trash2 className="text-rose-600" />
                              <span>Eliminar registro</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))
                )}
              </TableBody>
            </Table>
          </ModuleSurface>
        </div>
      </div>

      <Dialog open={editandoRegistro != null} onOpenChange={(open) => !open && setEditandoRegistro(null)}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar horario de registro</DialogTitle>
            {editandoRegistro ? (
              <DialogDescription>
                {editandoRegistro.operador} — {editandoRegistro.bano} ({editandoRegistro.fecha})
              </DialogDescription>
            ) : null}
          </DialogHeader>

            {errorEdit && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
                {errorEdit}
              </div>
            )}

            <form onSubmit={handleGuardarHorario} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Hora Entrada
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraEntrada}
                    onChange={(e) => setEditHoraEntrada(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Hora Llegada
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraLlegada}
                    onChange={(e) => setEditHoraLlegada(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>

              {/* Dynamic preview badge */}
              <div className="bg-muted border border-border rounded-lg p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Duración recalculada:</span>
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                  {editHoraEntrada && editHoraLlegada ? `${calcularMinutos(editHoraEntrada, editHoraLlegada)} min` : '--'}
                </span>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditandoRegistro(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={guardandoEdit}>
                  {guardandoEdit ? 'Guardando...' : 'Guardar horario'}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={solicitandoRegistro != null} onOpenChange={(open) => !open && setSolicitandoRegistro(null)}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar eliminación</DialogTitle>
            {solicitandoRegistro ? (
              <DialogDescription>
                {solicitandoRegistro.operador} — {solicitandoRegistro.bano} ({solicitandoRegistro.fecha})
              </DialogDescription>
            ) : null}
          </DialogHeader>

            {errorSolicitud && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
                {errorSolicitud}
              </div>
            )}

            <form onSubmit={handleEnviarSolicitud} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {MOTIVOS_SOLICITUD_BORRADO_BANO.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMotivoSolicitud(m.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      motivoSolicitud === m.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {motivoSolicitud === 'otro' && (
                <textarea
                  required
                  value={notaSolicitud}
                  onChange={(e) => setNotaSolicitud(e.target.value)}
                  placeholder="Explica brevemente el motivo..."
                  rows={3}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setSolicitandoRegistro(null)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={enviandoSolicitud || !motivoSolicitud}>
                  {enviandoSolicitud ? 'Enviando...' : 'Enviar solicitud'}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
