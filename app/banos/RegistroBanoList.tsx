'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { calcularMinutos, useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { Bano, Operador, RegistroBano } from '@/lib/schemas'
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from '@/lib/format'
import { resolverOperadorActivo, resolverOperadorPorQR } from '@/lib/banos-captura'
import {
  Plus,
  Trash2,
  Check,
  Search,
  Pencil,
  Clock,
  QrCode,
  Sparkles,
  Timer,
  CheckCircle2,
  Calendar,
  User,
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
  const confirmar = useConfirmDialog()
  const mesActual = fechaHoyLocal().slice(0, 7)
  const {
    registros,
    registrarEntrada,
    registrarLlegada,
    actualizarRegistro,
    borrarRegistro,
  } = useBanos(mesActual)
  const { activos: operadoresActivos } = useOperadores()

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

  // Estado para modal de edición completa del registro
  const [editandoRegistro, setEditandoRegistro] = useState<RegistroBano | null>(null)
  const [editOperador, setEditOperador] = useState('')
  const [editBano, setEditBano] = useState<Bano>('Baño #1')
  const [editFecha, setEditFecha] = useState('')
  const [editHoraEntrada, setEditHoraEntrada] = useState('')
  const [editHoraLlegada, setEditHoraLlegada] = useState('')
  const [editEnCurso, setEditEnCurso] = useState(false)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  function abrirModalEditar(r: RegistroBano) {
    setEditandoRegistro(r)
    setEditOperador(r.operador)
    setEditBano(r.bano)
    setEditFecha(r.fecha)
    setEditHoraEntrada(r.horaEntrada)
    setEditHoraLlegada(r.horaLlegada || '')
    setEditEnCurso(!r.horaLlegada)
    setErrorEdit(null)
  }

  async function handleGuardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!editandoRegistro) return
    if (!editOperador.trim()) {
      setErrorEdit('El nombre del operador es obligatorio.')
      return
    }
    if (!editFecha) {
      setErrorEdit('La fecha es obligatoria.')
      return
    }
    if (!editHoraEntrada) {
      setErrorEdit('La hora de entrada es obligatoria.')
      return
    }
    if (!editEnCurso && !editHoraLlegada) {
      setErrorEdit('Ingresa la hora de llegada o marca que el operador sigue en el baño.')
      return
    }

    setGuardandoEdit(true)
    setErrorEdit(null)
    try {
      const horaLlegadaFinal = editEnCurso ? null : editHoraLlegada
      await actualizarRegistro(editandoRegistro.id, {
        operador: editOperador.trim(),
        bano: editBano,
        fecha: editFecha,
        horaEntrada: editHoraEntrada,
        horaLlegada: horaLlegadaFinal,
      })
      const mins = horaLlegadaFinal ? calcularMinutos(editHoraEntrada, horaLlegadaFinal) : null
      toast.success(`Registro actualizado: ${editOperador.trim()}`, {
        description: `${editBano} · ${editHoraEntrada} ${horaLlegadaFinal ? `- ${horaLlegadaFinal} (${mins} min)` : '(En curso)'}`,
      })
      setEditandoRegistro(null)
    } catch (err) {
      console.error('Error guardando registro de baño:', err)
      setErrorEdit('No se pudo actualizar el registro. Intenta de nuevo.')
    } finally {
      setGuardandoEdit(false)
    }
  }

  async function handleEliminar(id: string, nombreOperador: string, banoNombre?: string) {
    const aceptado = await confirmar({
      title: 'Eliminar registro de baño',
      description: `¿Estás seguro de eliminar el registro de ${nombreOperador}${banoNombre ? ` (${banoNombre})` : ''}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar registro',
      variant: 'destructive',
    })
    if (!aceptado) return

    try {
      await borrarRegistro(id)
      toast.success(`Registro de ${nombreOperador} eliminado`)
    } catch (err) {
      console.error('Error eliminando registro:', err)
      toast.error('No se pudo eliminar el registro. Intenta de nuevo.')
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

    setAgregando(true)
    try {
      const horaActual = horaAhoraLocal()
      await registrarEntrada({
        operador: op.nombre,
        bano: banoDestino,
        horaEntrada: horaActual,
        fecha: fechaHoy,
      })
      const exito = `Registrada entrada de ${op.nombre} a ${banoDestino} (${horaActual})`
      setMensajeExito(exito)
      toast.success(exito)
      setOperador('')
      setIndicadorHora(new Date())
    } catch (err) {
      console.error('Error al registrar entrada:', err)
      const fallback = 'No se pudo registrar la entrada. Intenta de nuevo.'
      setErrorCaptura(fallback)
      toast.error(fallback)
    } finally {
      setAgregando(false)
    }
  }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    const opEncontrado = resolverOperadorActivo(operador, operadoresActivos)
    if (!opEncontrado) {
      const errorMsg = 'Selecciona un operador activo de la lista'
      setErrorCaptura(errorMsg)
      toast.error(errorMsg)
      return
    }

    await registrarEntradaDirecta(opEncontrado, bano)
  }

  async function handleQRScanned(qrData: string) {
    setIsLectorQROpen(false)
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    const opEncontrado = resolverOperadorPorQR(qrData, operadoresActivos)
    if (!opEncontrado) {
      const msg = 'El código QR no corresponde a ningún operador activo.'
      setErrorCaptura(msg)
      toast.error(msg)
      return
    }

    await registrarEntradaDirecta(opEncontrado, bano)
  }

  async function handleLlegada(id: string, horaEntrada: string, nombreOperador: string) {
    try {
      const horaLlegada = horaAhoraLocal()
      await registrarLlegada(id, horaLlegada, horaEntrada)
      const mins = calcularMinutos(horaEntrada, horaLlegada)
      toast.success(`Llegada registrada: ${nombreOperador}`, {
        description: `Duración: ${mins} minutos (${horaEntrada} - ${horaLlegada})`,
      })
    } catch (err) {
      console.error('Error registrando llegada:', err)
      toast.error('No se pudo registrar la llegada. Intenta de nuevo.')
    }
  }

  // Filtrado de registros de hoy
  const registrosHoy = useMemo(() => {
    return registros.filter((r) => r.fecha === fechaHoy)
  }, [registros, fechaHoy])

  const enCurso = useMemo(() => {
    return registrosHoy.filter((r) => !r.horaLlegada)
  }, [registrosHoy])

  const terminadosTodos = useMemo(() => {
    return registrosHoy.filter((r) => r.horaLlegada)
  }, [registrosHoy])

  const filtro = busqueda.toLowerCase().trim()
  const terminados = useMemo(() => {
    if (!filtro) return terminadosTodos
    return terminadosTodos.filter((r) => r.operador.toLowerCase().includes(filtro))
  }, [terminadosTodos, filtro])

  return (
    <div className="space-y-6">
      {/* ── SECCIÓN SUPERIOR: CAPTURA RÁPIDA (PUNCH DIRECTO & QR) ── */}
      <ModuleSurface className="p-4 sm:p-5 space-y-4 border border-border shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Registrar Visita al Baño</span>
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Almacén / Control Directo
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              1. Selecciona el baño · 2. Presiona el operador o escanea su gafete QR
            </p>
          </div>

          {/* Botón Escáner QR */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsLectorQROpen(true)}
            className="w-full sm:w-auto h-10 px-4 rounded-xl border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold flex items-center justify-center gap-2 text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <QrCode className="size-4" />
            <span>Escanear Gafete QR</span>
          </Button>
        </div>

        {/* 1. Selector de Baño (Pills Obligatorios) */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            1. Baño de destino:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BANOS.map((b) => {
              const seleccionado = bano === b
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleSeleccionarBano(b)}
                  className={`h-11 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    seleccionado
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {seleccionado && <Check className="size-4 stroke-[3]" />}
                  <span>{b}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mensajes de feedback */}
        {errorDuplicado && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 font-medium">
            {errorDuplicado}
          </div>
        )}
        {errorCaptura && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive font-medium">
            {errorCaptura}
          </div>
        )}
        {mensajeExito && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-medium flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* 2. Operadores Frecuentes / 1-Tap Punch */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-400" />
              <span>2. Toque rápido (Operadores del turno)</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              Toca para registrar entrada a <strong>{bano}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {operadoresFrecuentes.map((op) => {
              const estaAdentro = registros.some(
                (r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada
              )
              return (
                <button
                  key={op.id}
                  type="button"
                  disabled={agregando || estaAdentro}
                  onClick={() => void registrarEntradaDirecta(op, bano)}
                  title={estaAdentro ? `${op.nombre} ya está en el baño` : `Registrar entrada de ${op.nombre}`}
                  className={`h-10 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all text-left truncate cursor-pointer active:scale-95 ${
                    estaAdentro
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 opacity-60 cursor-not-allowed'
                      : 'border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary/5 shadow-2xs'
                  }`}
                >
                  <span className={`size-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 border ${AREA_COLORS[op.area || 'taller'] || 'bg-muted text-muted-foreground border-border'}`}>
                    {getInitials(op.nombre)}
                  </span>
                  <span className="truncate">{op.nombre.split(' ')[0]}</span>
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
              Presiona &ldquo;Llegó&rdquo; cuando regrese o edita/elimina si hubo error
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirModalEditar(r)}
                      title="Editar datos del registro"
                      className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleEliminar(r.id, r.operador, r.bano)}
                      title="Cancelar / Eliminar registro"
                      className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void handleLlegada(r.id, r.horaEntrada, r.operador)}
                      className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
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
                <TableHead className="px-4 py-2.5 w-24 text-right">Acciones</TableHead>
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
                          title="Editar registro"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleEliminar(r.id, r.operador, r.bano)}
                          title="Eliminar registro"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ModuleSurface>
      </div>

      {/* Modal de Edición Completa del Registro */}
      <Dialog open={editandoRegistro != null} onOpenChange={(open) => !open && setEditandoRegistro(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar registro de baño</DialogTitle>
            <DialogDescription>
              Corrige los datos del operador, baño, fecha u horario.
            </DialogDescription>
          </DialogHeader>

          {errorEdit && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-lg text-xs font-medium">
              {errorEdit}
            </div>
          )}

          <form onSubmit={handleGuardarEdicion} className="space-y-4">
            {/* Operador */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Operador
              </label>
              <input
                list="modal-operadores-list"
                required
                value={editOperador}
                onChange={(e) => setEditOperador(e.target.value)}
                placeholder="Nombre del operador..."
                className="w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 font-medium"
              />
              <datalist id="modal-operadores-list">
                {operadoresActivos.map(op => (
                  <option key={op.id} value={op.nombre} />
                ))}
              </datalist>
            </div>

            {/* Baño */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Baño
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {BANOS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setEditBano(b)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      editBano === b
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Fecha
              </label>
              <input
                type="date"
                required
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                className="w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 font-mono"
              />
            </div>

            {/* Horas */}
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
                  className="w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Hora Llegada
                </label>
                <input
                  type="time"
                  disabled={editEnCurso}
                  required={!editEnCurso}
                  value={editHoraLlegada}
                  onChange={(e) => setEditHoraLlegada(e.target.value)}
                  className={`w-full rounded-lg border border-input bg-card text-foreground px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 font-mono ${
                    editEnCurso ? 'opacity-40 cursor-not-allowed bg-muted' : ''
                  }`}
                />
              </div>
            </div>

            {/* Checkbox Aún en el baño */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-en-curso"
                checked={editEnCurso}
                onChange={(e) => {
                  setEditEnCurso(e.target.checked)
                  if (e.target.checked) {
                    setEditHoraLlegada('')
                  } else if (!editHoraLlegada) {
                    setEditHoraLlegada(horaAhoraLocal())
                  }
                }}
                className="size-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <label htmlFor="edit-en-curso" className="text-xs font-medium text-foreground cursor-pointer select-none">
                El operador aún está en el baño (En curso)
              </label>
            </div>

            {/* Resumen de duración recalculada */}
            <div className="bg-muted border border-border rounded-lg p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Estado / Duración:</span>
              <span className={`rounded border px-2 py-0.5 text-xs font-bold ${
                editEnCurso
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-primary/20 bg-primary/10 text-primary'
              }`}>
                {editEnCurso
                  ? 'En curso'
                  : editHoraEntrada && editHoraLlegada
                    ? `${calcularMinutos(editHoraEntrada, editHoraLlegada)} min`
                    : '--'}
              </span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditandoRegistro(null)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={guardandoEdit} className="cursor-pointer font-bold">
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
