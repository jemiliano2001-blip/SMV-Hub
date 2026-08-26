'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
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
import {
  Plus,
  Trash2,
  Check,
  Search,
  Pencil,
  Clock,
  QrCode,
  Sparkles,
  UserCheck,
  Timer,
  CheckCircle2,
} from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { LectorQR } from '@/components/LectorQR'
import { toast } from 'sonner'
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
  taller: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  diseno: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  automatizacion: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cnc: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  limpieza: 'bg-muted text-muted-foreground border-border',
  administracion: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default function RegistroBanoList() {
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

  // Reloj en vivo para actualizar el tiempo transcurrido en pantalla
  const [relojMinuto, setRelojMinuto] = useState(() => horaAhoraLocal())
  useEffect(() => {
    const intervalo = setInterval(() => {
      setRelojMinuto(horaAhoraLocal())
    }, 15000)
    return () => clearInterval(intervalo)
  }, [])

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

  // Estado para modal de solicitud de eliminación
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
        toast.info('La solicitud no procedió; el registro se conserva.')
      } else {
        toast.success(
          data.estado === 'auto_aprobada'
            ? `Se eliminó el registro de ${solicitandoRegistro.operador}.`
            : 'Solicitud enviada para revisión.'
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
      toast.success(`Horario actualizado: ${editandoRegistro.operador}`, {
        description: `${editHoraEntrada} - ${editHoraLlegada} (${mins} min)`,
      })
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
    const restantes = operadoresActivos.filter((op) => !nombresHoy.has(op.nombre))
    return [...frecuentes, ...restantes].slice(0, 10)
  }, [registros, operadoresActivos, fechaHoy])

  async function registrarEntradaDirecta(op: Operador, banoDestino: Bano) {
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    if (registros.some((r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada)) {
      const msg = `${op.nombre} ya está registrado en el baño. Marca "Llegó" cuando regrese.`
      setErrorDuplicado(msg)
      toast.warning(msg)
      return
    }

    const ahora = new Date()
    const fecha = fechaHoyLocal(ahora)
    const horaEntrada = horaAhoraLocal(ahora)

    setAgregando(true)
    try {
      await registrarEntrada({ fecha, operador: op.nombre, bano: banoDestino, horaEntrada })
      toast.success(`Entrada: ${op.nombre}`, {
        description: `${banoDestino} a las ${horaEntrada}`,
      })
      setOperador('')
      setIndicadorHora(ahora)
      setTimeout(() => operadorInputRef.current?.focus(), 50)
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
      setErrorCaptura('Operador no encontrado. Selecciona un nombre válido de la lista.')
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

  async function handleLlegada(id: string, horaOriginal: string, nombreOp: string) {
    const horaLlegada = horaAhoraLocal()
    try {
      await registrarLlegada(id, horaLlegada, horaOriginal)
      const mins = calcularMinutos(horaOriginal, horaLlegada)
      toast.success(`Regresó: ${nombreOp}`, {
        description: `${horaOriginal} - ${horaLlegada} (${mins} min)`,
      })
    } catch (err) {
      console.error('Error registrando llegada:', err)
      setErrorCaptura('No se pudo registrar la llegada. Intenta de nuevo.')
      toast.error('Error al registrar llegada')
    }
  }

  async function handleEliminar(id: string, op: string) {
    const aceptado = await confirmar({
      title: 'Eliminar registro',
      description: `¿Estás seguro de eliminar el registro de ${op}?`,
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
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-card rounded-2xl border border-border" />
        <div className="h-44 bg-card rounded-2xl border border-border" />
        <div className="h-64 bg-card rounded-2xl border border-border" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive bg-destructive/10 border border-destructive/20 p-4 rounded-xl text-sm space-y-2">
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

  return (
    <div className="space-y-6">
      {/* ── KPIs Rápidos y Claros de Hoy ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              En el baño ahora
            </span>
            {enCursoTodos.length > 0 && (
              <span className="flex size-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-foreground flex items-baseline gap-2">
            <span>{enCursoTodos.length}</span>
            <span className="text-xs font-medium text-muted-foreground">
              {enCursoTodos.length === 1 ? 'persona' : 'personas'}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Promedio hoy
          </span>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-foreground flex items-baseline gap-1.5">
            <span>{promedio}</span>
            <span className="text-xs font-medium text-muted-foreground">min / visita</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Completados hoy
          </span>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-foreground flex items-baseline gap-1.5">
            <span>{terminadosTodos.length}</span>
            <span className="text-xs font-medium text-muted-foreground">salidas</span>
          </p>
        </div>
      </div>

      {mensajeExito && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-emerald-400 text-sm animate-in fade-in-50">
          {mensajeExito}
        </div>
      )}
      {errorCaptura && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 text-destructive text-sm animate-in fade-in-50">
          {errorCaptura}
        </div>
      )}
      {errorDuplicado && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-amber-400 text-sm animate-in fade-in-50">
          {errorDuplicado}
        </div>
      )}

      {/* ── Tarjeta Principal de Captura Rápida de Entrada ── */}
      <ModuleSurface className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Registro Rápido de Entrada
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Selecciona el baño y escribe o toca el nombre del operador
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsLectorQROpen(true)}
            className="h-8 px-3 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer rounded-xl shrink-0"
          >
            <QrCode className="size-3.5" />
            <span>Escanear Gafete</span>
          </Button>
        </div>

        {/* 1. Selector de Baño */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>1. Baño asignado</span>
            <span className="text-[10px] text-muted-foreground font-normal">(se guarda tu última opción)</span>
          </label>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
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

        {/* 2. Operadores Frecuentes (1-Toque para registrar) */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <UserCheck className="size-3.5" />
            <span>2. Operadores frecuentes de hoy (1-Toque para registrar)</span>
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
                  title={estaAdentro ? `${op.nombre} ya está adentro` : `Registrar entrada de ${op.nombre}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all shrink-0 cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    estaAdentro
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary/5 shadow-2xs'
                  }`}
                >
                  <span className={`size-4 rounded-full flex items-center justify-center text-[8px] font-bold border ${AREA_COLORS[op.area || 'taller'] || 'bg-muted text-muted-foreground border-border'}`}>
                    {getInitials(op.nombre)}
                  </span>
                  <span>{op.nombre.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Buscador con Datalist y Botón de Entrada */}
        <form onSubmit={handleAgregar} className="flex flex-wrap items-end gap-3 pt-2 border-t border-border">
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-semibold text-foreground mb-1">
              3. O escribe/busca operador por nombre
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                list="operadores-list"
                ref={operadorInputRef}
                required
                placeholder="Escribe el nombre del operador..."
                value={operador}
                onChange={(e) => {
                  setOperador(e.target.value)
                  setErrorDuplicado(null)
                  setErrorCaptura(null)
                }}
                className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-input rounded-xl bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-medium"
              />
            </div>
            <datalist id="operadores-list">
              {operadoresActivos.map(op => (
                <option key={op.id} value={op.nombre} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatIndicadorCapturaBano(indicadorHora)}
            </p>
          </div>

          <Button
            type="submit"
            disabled={agregando || yaEnCurso || !bano}
            className="w-full sm:w-auto h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Entrada</span>
          </Button>
        </form>
      </ModuleSurface>

      {/* Modal de Escáner QR de Gafetes */}
      <LectorQR
        isOpen={isLectorQROpen}
        onClose={() => setIsLectorQROpen(false)}
        onScan={handleQRScanned}
        titulo="Escanear Gafete del Operador"
        subtitulo="Apunta la cámara al código QR del gafete para registrar su entrada al instante"
      />

      {/* ── SECCIÓN 1: EN EL BAÑO AHORA (MÁXIMO PROTAGONISMO) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-3 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-base font-extrabold text-foreground">
              En el baño ahora ({enCurso.length})
            </h3>
          </div>
          {enCurso.length > 0 && (
            <span className="text-xs text-muted-foreground font-medium">
              Presiona &ldquo;Llegó&rdquo; cuando el operador regrese al taller
            </span>
          )}
        </div>

        {enCurso.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
            <CheckCircle2 className="size-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold text-foreground">Nadie en el baño en este momento</p>
            <p className="text-xs text-muted-foreground">
              Usa el formulario superior para registrar la entrada de cualquier operador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enCurso.map((r) => {
              const mins = calcularMinutos(r.horaEntrada, relojMinuto)
              const esLargo = mins >= 15
              const esMedio = mins >= 10 && mins < 15

              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-xs transition-all bg-card ${
                    esLargo
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : esMedio
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-border'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-muted text-muted-foreground border-border'}`}>
                        {getInitials(r.operador)}
                      </div>
                      <p className="font-bold text-base text-foreground truncate">
                        {r.operador}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                        {r.bano}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" />
                        Entró: <strong>{r.horaEntrada}</strong>
                      </span>
                      <span>·</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-xs flex items-center gap-1 ${
                        esLargo
                          ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30'
                          : esMedio
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        <Timer className="size-3" />
                        {mins} min
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalEditar(r)}
                      title="Corregir hora de entrada"
                      className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void handleLlegada(r.id, r.horaEntrada, r.operador)}
                      className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-xs active:scale-95 cursor-pointer"
                    >
                      <Check className="size-4.5 stroke-[3]" />
                      <span>Llegó</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: COMPLETADOS HOY (HISTORIAL LIMPIO DEL DÍA) ── */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">
              Completados hoy ({terminados.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrar por operador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-input bg-card text-foreground rounded-xl focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <ModuleSurface>
          <Table className="text-xs">
            <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border">
              <TableRow>
                <TableHead className="px-4 py-2.5">Operador</TableHead>
                <TableHead className="px-4 py-2.5">Baño</TableHead>
                <TableHead className="px-4 py-2.5 w-36">Horario</TableHead>
                <TableHead className="px-4 py-2.5 w-20 text-right">Tiempo</TableHead>
                <TableHead className="px-4 py-2.5 w-20 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {terminados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    {filtro && terminadosTodos.length > 0 ? 'Sin coincidencias' : 'No hay registros completados hoy'}
                  </TableCell>
                </TableRow>
              ) : (
                terminados.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="px-4 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-muted text-muted-foreground border-border'}`}>
                          {getInitials(r.operador)}
                        </div>
                        <span className="font-semibold">{r.operador}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">{r.bano}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground font-mono">
                      {r.horaEntrada} - {r.horaLlegada}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right font-bold text-foreground">
                      {r.tiempoMinutos} min
                    </TableCell>
                    <TableCell className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModalEditar(r)}
                          title="Editar horario"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {puedeEliminar ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEliminar(r.id, r.operador)}
                            title="Eliminar registro (Super Admin)"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : (
                          !puedeEliminar && !!usuario?.uid && r.creadoPorUid === usuario.uid && (
                            r.solicitudBorradoEstado === 'pendiente' ? (
                              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                Pendiente
                              </span>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirModalSolicitud(r)}
                                title="Solicitar corrección/borrado"
                                className="h-7 px-2 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                              >
                                Corregir
                              </Button>
                            )
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleSurface>
      </div>

      {/* Modal de Editar Horario */}
      <Dialog open={editandoRegistro != null} onOpenChange={(open) => !open && setEditandoRegistro(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar horario de registro</DialogTitle>
            {editandoRegistro ? (
              <DialogDescription>
                {editandoRegistro.operador} — {editandoRegistro.bano} ({editandoRegistro.fecha})
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {errorEdit && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-lg text-xs">
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

      {/* Modal de Solicitud de Borrado */}
      <Dialog open={solicitandoRegistro != null} onOpenChange={(open) => !open && setSolicitandoRegistro(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar eliminación de registro</DialogTitle>
            {solicitandoRegistro ? (
              <DialogDescription>
                {solicitandoRegistro.operador} — {solicitandoRegistro.bano} ({solicitandoRegistro.fecha})
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {errorSolicitud && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-lg text-xs">
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
