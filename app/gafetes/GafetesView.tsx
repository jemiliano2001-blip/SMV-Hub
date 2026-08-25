"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Search,
  Users,
  Copy,
  CheckSquare,
  Square,
} from "lucide-react"
import { copiarAlPortapapeles } from "@/lib/portapapeles"
import { authBypassActivo, useUsuario } from "@/lib/auth"
import { usePermisos } from "@/lib/hooks/useRol"
import { useOperadores } from "@/lib/hooks/useOperadores"
import { actualizarOperador } from "@/lib/operadores"
import {
  AJUSTE_FOTO_INICIAL,
  agruparGafetesParaImpresion,
  DATOS_TALLER_GAFETES,
  estaCompletoGafete,
  listarGafetes,
  MEDIDAS_GAFETE_PULGADAS,
  normalizarAjusteFoto,
  guardarGafete,
  type GafetePerfilPayload,
} from "@/lib/gafetes"
import { cargarFotoGafete, subirFotoGafete } from "@/lib/storage"
import type { Area, GafeteAjusteFoto, GafetePerfil, Operador } from "@/lib/schemas"
import ModuleSurface from "@/components/layout/ModuleSurface"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/dialog"

const AREAS: { value: Area; label: string }[] = [
  { value: "taller", label: "Taller" },
  { value: "diseno", label: "Diseño" },
  { value: "automatizacion", label: "Automatización" },
  { value: "cnc", label: "CNC" },
  { value: "limpieza", label: "Limpieza" },
  { value: "administracion", label: "Administración" },
]

/** Clases de formulario en pantalla (no tocar el CSS de impresión del gafete). */
const CAMPO_GAFETE_CLASS =
  "w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

const AJUSTE_FOTO_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted"

type FormularioGafete = Omit<GafetePerfilPayload, "operadorId"> & {
  nombre: string
  area: Area
  /** URL local efímera para previsualización; jamás se persiste en Firestore. */
  fotoUrl: string
}

type GafeteListo = { operador: Operador; perfil: GafetePerfil }
type GafetePerfilVista = GafetePerfil & { fotoUrl: string }

function estaListoParaImprimir(perfil: GafetePerfilVista | null | undefined): perfil is GafetePerfilVista {
  return estaCompletoGafete(perfil) && Boolean(perfil.fotoUrl)
}

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).map((parte) => parte[0]).join("").slice(0, 2).toUpperCase()
}

function areaTexto(area: Area) {
  return AREAS.find((item) => item.value === area)?.label ?? area
}

function crearFormulario(operador: Operador, perfil?: GafetePerfil | null): FormularioGafete {
  return {
    nombre: operador.nombre,
    area: operador.area,
    cargo: perfil?.cargo ?? "",
    fechaIngreso: perfil?.fechaIngreso ?? "",
    nss: perfil?.nss ?? "",
    rfc: perfil?.rfc ?? "",
    fotoUrl: "",
    fotoPath: perfil?.fotoPath ?? "",
    fotoAjuste: normalizarAjusteFoto(perfil?.fotoAjuste ?? AJUSTE_FOTO_INICIAL),
  }
}

function LogoGafete() {
  return (
    // El archivo institucional ya está optimizado para fondo azul y se imprime como parte del gafete.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/smv-logo.png" alt="SMV" className="gafete-logo" />
  )
}

function FotoGafete({
  url,
  ajuste,
  nombre,
  className = "",
}: {
  url: string
  ajuste: GafeteAjusteFoto
  nombre: string
  className?: string
}) {
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-200 text-slate-500 font-black ${className}`}>
        {iniciales(nombre)}
      </div>
    )
  }
  return (
    <div className={`overflow-hidden bg-slate-200 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Foto de ${nombre}`}
        className="h-full w-full object-cover"
        style={{
          transform: `translate(${ajuste.desplazamientoX}%, ${ajuste.desplazamientoY}%) scale(${ajuste.zoom}) rotate(${ajuste.rotacion}deg)`,
        }}
      />
    </div>
  )
}

function CaraGafete({ item, reverso = false }: { item: GafeteListo; reverso?: boolean }) {
  const { operador, perfil } = item
  if (reverso) {
    return (
      <article className="gafete-card gafete-reverso" aria-label={`Reverso de gafete de ${operador.nombre}`}>
        <LogoGafete />
        <p className="gafete-eyebrow">RESPONSABLE</p>
        <p className="gafete-responsable">{DATOS_TALLER_GAFETES.responsableNombre}</p>
        <p className="gafete-puesto">{DATOS_TALLER_GAFETES.responsablePuesto}</p>
        <p className="gafete-telefono">{DATOS_TALLER_GAFETES.responsableTelefono}</p>
        <div className="gafete-datos-legales">
          <p><strong>Fecha de ingreso:</strong> {perfil.fechaIngreso}</p>
          <p><strong>NSS:</strong> {perfil.nss}</p>
          <p><strong>RFC:</strong> {perfil.rfc}</p>
        </div>
        <div className="gafete-pie">SERVICIOS Y MAQUINADOS VÁZQUEZ</div>
      </article>
    )
  }

  return (
    <article className="gafete-card gafete-frente" aria-label={`Frente de gafete de ${operador.nombre}`}>
      <LogoGafete />
      <div className="gafete-foto-marco">
        <FotoGafete url={(perfil as GafetePerfilVista).fotoUrl ?? ""} ajuste={perfil.fotoAjuste} nombre={operador.nombre} className="h-full w-full" />
      </div>
      <h2 className="gafete-nombre">{operador.nombre}</h2>
      <p className="gafete-cargo">{perfil.cargo || areaTexto(operador.area)}</p>
      <div className="gafete-linea" />
      <p className="gafete-domicilio">{DATOS_TALLER_GAFETES.domicilio}</p>
      <div className="gafete-pie">SERVICIOS Y MAQUINADOS VÁZQUEZ</div>
    </article>
  )
}

function HojaImpresion({ hoja, reverso }: { hoja: GafeteListo[]; reverso: boolean }) {
  return (
    <section className="gafete-print-sheet">
      {hoja.map((item) => (
        <div key={item.operador.id} className="gafete-print-cell">
          <CaraGafete item={item} reverso={reverso} />
          <span className="gafete-crop gafete-crop-tl" />
          <span className="gafete-crop gafete-crop-tr" />
          <span className="gafete-crop gafete-crop-bl" />
          <span className="gafete-crop gafete-crop-br" />
        </div>
      ))}
    </section>
  )
}

export default function GafetesView() {
  const { usuario } = useUsuario()
  const { esSuperAdmin, cargando: cargandoPermisos } = usePermisos(authBypassActivo() ? null : usuario)
  const { operadores, loading: cargandoOperadores, fetchOperadores } = useOperadores()
  const [perfiles, setPerfiles] = useState<GafetePerfilVista[]>([])
  const [cargandoPerfiles, setCargandoPerfiles] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [editando, setEditando] = useState<Operador | null>(null)
  const [formulario, setFormulario] = useState<FormularioGafete | null>(null)
  const [fotoNueva, setFotoNueva] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)

  const perfilesPorOperador = useMemo(
    () => new Map(perfiles.map((perfil) => [perfil.operadorId, perfil])),
    [perfiles]
  )

  async function cargarPerfiles() {
    setCargandoPerfiles(true)
    setError(null)
    try {
      const perfilesPrivados = await listarGafetes()
      const conFotos = await Promise.all(perfilesPrivados.map(async (perfil) => ({
        ...perfil,
        fotoUrl: await cargarFotoGafete(perfil.fotoPath).catch(() => ""),
      })))
      setPerfiles(conFotos)
    } catch (err) {
      console.error("Error cargando gafetes:", err)
      setError("No se pudieron cargar los perfiles privados.")
    } finally {
      setCargandoPerfiles(false)
    }
  }

  useEffect(() => {
    if (esSuperAdmin || authBypassActivo()) {
      void Promise.resolve().then(cargarPerfiles)
    }
  }, [esSuperAdmin])

  const trabajadores = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es")
    return operadores.filter((operador) => {
      if (!q) return true
      const perfil = perfilesPorOperador.get(operador.id)
      return [operador.nombre, areaTexto(operador.area), perfil?.cargo ?? ""]
        .some((valor) => valor.toLocaleLowerCase("es").includes(q))
    })
  }, [busqueda, operadores, perfilesPorOperador])

  const imprimibles = useMemo<GafeteListo[]>(() => {
    return seleccionados.flatMap((id) => {
      const operador = operadores.find((item) => item.id === id)
      const perfil = perfilesPorOperador.get(id)
      return operador && estaListoParaImprimir(perfil) ? [{ operador, perfil }] : []
    })
  }, [operadores, perfilesPorOperador, seleccionados])

  function abrirEdicion(operador: Operador) {
    setError(null)
    setEditando(operador)
    setFormulario(crearFormulario(operador, perfilesPorOperador.get(operador.id)))
    setFotoNueva(null)
  }

  function cerrarEdicion() {
    setEditando(null)
    setFormulario(null)
    setFotoNueva(null)
  }

  function actualizarAjuste(cambios: Partial<{ rotacion: number; zoom: number; desplazamientoX: number; desplazamientoY: number }>) {
    setFormulario((actual) => actual ? {
      ...actual,
      fotoAjuste: normalizarAjusteFoto({ ...actual.fotoAjuste, ...cambios }),
    } : actual)
  }

  function seleccionarFoto(file: File | undefined) {
    if (!file || !formulario) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size >= 10 * 1024 * 1024) {
      setError("La foto debe ser JPG, PNG o WebP y pesar menos de 10 MB.")
      return
    }
    setError(null)
    setFotoNueva(file)
    setFormulario({ ...formulario, fotoUrl: URL.createObjectURL(file), fotoPath: "pendiente" })
  }

  async function guardar() {
    if (!editando || !formulario) return
    const nombre = formulario.nombre.trim()
    if (!nombre) {
      setError("El nombre del trabajador es obligatorio.")
      return
    }
    const duplicado = operadores.some((op) => op.id !== editando.id && op.nombre.trim().toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"))
    if (duplicado) {
      setError("Ya existe otro operador con ese nombre.")
      return
    }

    setGuardando(true)
    setError(null)
    try {
      let fotoPath = formulario.fotoPath
      if (fotoNueva) {
        const subida = await subirFotoGafete(editando.id, fotoNueva)
        fotoPath = subida.path
      }

      if (nombre !== editando.nombre || formulario.area !== editando.area) {
        await actualizarOperador(editando.id, { nombre, area: formulario.area })
      }

      const perfilAnterior = perfilesPorOperador.get(editando.id)
      await guardarGafete({
        operadorId: editando.id,
        cargo: formulario.cargo.trim(),
        fechaIngreso: formulario.fechaIngreso,
        nss: formulario.nss.trim(),
        rfc: formulario.rfc.trim().toUpperCase(),
        fotoPath,
        fotoAjuste: formulario.fotoAjuste,
      }, perfilAnterior?.creadoEn)
      await Promise.all([fetchOperadores(), cargarPerfiles()])
      cerrarEdicion()
    } catch (err) {
      console.error("Error guardando gafete:", err)
      setError("No se pudo guardar el perfil. Revisa tu conexión e inténtalo nuevamente.")
    } finally {
      setGuardando(false)
    }
  }

  function alternarSeleccion(id: string) {
    setSeleccionados((actual) => actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id])
  }

  function imprimir() {
    if (imprimibles.length === 0) {
      setError("Selecciona al menos un gafete completo para imprimir.")
      return
    }
    window.print()
  }

  const hojas = agruparGafetesParaImpresion(imprimibles)
  const cargando = cargandoPermisos || cargandoOperadores || cargandoPerfiles

  return (
    <PageShell
      className="gafetes-page"
      printClassName="print:bg-white"
      innerClassName="print:max-w-none print:px-0 print:py-0 print:gap-0"
    >
      <style>{`
        .gafete-card { width: ${MEDIDAS_GAFETE_PULGADAS.ancho}in; height: ${MEDIDAS_GAFETE_PULGADAS.alto}in; position: relative; overflow: hidden; color: white; background: radial-gradient(circle at 56% 45%, #087bc7 0, #054e93 31%, #082852 74%, #061936 100%); box-shadow: 0 10px 25px rgba(15, 23, 42, .25); font-family: Arial, sans-serif; }
        .gafete-card::before { content: ''; position: absolute; z-index: 0; width: 4.6in; height: 4.6in; border: .65pt solid rgba(125, 211, 252, .46); transform: rotate(42deg); top: -2.23in; right: -2.1in; box-shadow: 0 0 0 .11in rgba(14, 165, 233, .07), 0 0 0 .22in rgba(14, 165, 233, .05); }
        .gafete-card::after { content: ''; position: absolute; z-index: 0; width: 3.1in; height: 2.7in; background: repeating-linear-gradient(135deg, transparent 0 .075in, rgba(125, 211, 252, .20) .08in .088in, transparent .093in .15in); transform: rotate(-15deg); bottom: -.92in; left: -.88in; opacity: .7; }
        .gafete-logo { position: absolute; top: .18in; left: .18in; z-index: 1; width: .93in; height: auto; object-fit: contain; }
        .gafete-frente { display: flex; flex-direction: column; align-items: center; padding: .56in .2in .18in; text-align: center; }
        .gafete-foto-marco { position: relative; z-index: 1; width: 1.26in; height: 1.52in; border: .03in solid white; border-radius: .08in; overflow: hidden; background: #e2e8f0; box-shadow: 0 .04in .13in rgba(0,0,0,.28); }
        .gafete-nombre { position: relative; z-index: 1; width: 100%; margin: .17in 0 .04in; font-size: .20in; line-height: 1.05; font-weight: 800; text-transform: uppercase; }
        .gafete-cargo { position: relative; z-index: 1; margin: 0; max-width: 2.05in; font-size: .105in; font-weight: 600; line-height: 1.25; min-height: .27in; }
        .gafete-linea { position: relative; z-index: 1; width: 1.75in; height: .012in; margin: .08in 0 .12in; background: rgba(255,255,255,.9); }
        .gafete-domicilio { position: relative; z-index: 1; margin: 0; width: 2.04in; font-size: .083in; line-height: 1.35; }
        .gafete-pie { position: absolute; z-index: 1; bottom: .13in; left: .18in; right: .18in; font-size: .07in; font-weight: 700; letter-spacing: .025in; text-align: center; opacity: .95; }
        .gafete-reverso { padding: .82in .25in .18in; }
        .gafete-eyebrow { position: relative; z-index: 1; margin: 0 0 .09in; color: #bae6fd; font-size: .08in; font-weight: 800; letter-spacing: .025in; }
        .gafete-responsable { position: relative; z-index: 1; margin: 0; font-size: .19in; line-height: 1.1; font-weight: 800; }
        .gafete-puesto { position: relative; z-index: 1; margin: .07in 0 0; font-size: .10in; font-weight: 600; line-height: 1.25; }
        .gafete-telefono { position: relative; z-index: 1; margin: .06in 0 0; font-size: .12in; font-weight: 800; }
        .gafete-datos-legales { position: absolute; z-index: 1; left: .25in; right: .25in; bottom: .45in; border-top: .012in solid rgba(255,255,255,.7); padding-top: .14in; font-size: .092in; line-height: 1.55; }
        .gafete-datos-legales p { margin: 0; }
        .gafete-print-root { display: none; }
        @media print { @page { size: letter portrait; margin: 0; } header, .gafetes-screen { display: none !important; } .gafete-print-root { display: block !important; } .gafete-print-sheet { width: 8.5in; height: 11in; display: grid; grid-template-columns: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.ancho}in); grid-template-rows: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.alto}in); column-gap: .26in; row-gap: .26in; padding: 1.568in 1.658in; box-sizing: border-box; break-after: page; page-break-after: always; } .gafete-print-sheet:last-child { break-after: auto; page-break-after: auto; } .gafete-print-cell { position: relative; } .gafete-crop { position: absolute; width: .09in; height: .09in; border-color: #111; border-style: solid; } .gafete-crop-tl { left: -.06in; top: -.06in; border-width: .01in 0 0 .01in; } .gafete-crop-tr { right: -.06in; top: -.06in; border-width: .01in .01in 0 0; } .gafete-crop-bl { left: -.06in; bottom: -.06in; border-width: 0 0 .01in .01in; } .gafete-crop-br { right: -.06in; bottom: -.06in; border-width: 0 .01in .01in 0; } }
      `}</style>

      <div className="gafetes-screen flex flex-col gap-4">
        <PageHeader
          title="Gafetes de personal"
          badge="Super-admin"
          icon={Users}
          description="Perfiles vinculados al personal maestro e impresión a doble cara en tamaño real."
          className="print:hidden"
          actions={
            <Button size="sm" onClick={imprimir} disabled={imprimibles.length === 0}>
              <Printer data-icon="inline-start" />
              Imprimir {imprimibles.length || ""} gafete{imprimibles.length === 1 ? "" : "s"}
            </Button>
          }
        />

        <section className="rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Impresión:</strong> elige “Tamaño real” o 100%, papel Carta, doble cara y <strong className="text-foreground">voltear por borde largo</strong>. Cada frente y reverso se colocan en la misma posición y mide {MEDIDAS_GAFETE_PULGADAS.ancho} × {MEDIDAS_GAFETE_PULGADAS.alto} pulgadas.
        </section>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <ModuleSurface>
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar trabajador, área o cargo…"
                className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{imprimibles.length}</strong> completos listos para imprimir
              {seleccionados.length - imprimibles.length > 0
                ? ` · ${seleccionados.length - imprimibles.length} borrador(es) excluido(s)`
                : ""}
            </p>
          </div>

          {cargando ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando personal y perfiles…</div>
          ) : (
            <div className="divide-y divide-border">
              {trabajadores.map((operador) => {
                const perfil = perfilesPorOperador.get(operador.id)
                const completo = estaListoParaImprimir(perfil)
                const seleccionado = seleccionados.includes(operador.id)
                const cargoOArea = perfil?.cargo || areaTexto(operador.area)

                return (
                  <ContextMenu key={operador.id}>
                    <ContextMenuTrigger asChild>
                      <article
                        className={`flex cursor-pointer select-none items-center gap-3 p-3 transition-colors hover:bg-muted/60 sm:px-4 ${!operador.activo ? "opacity-55" : ""}`}
                      >
                        <input
                          aria-label={`Seleccionar ${operador.nombre} para imprimir`}
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => alternarSeleccion(operador.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                        />
                        <FotoGafete
                          url={perfil?.fotoUrl ?? ""}
                          ajuste={perfil?.fotoAjuste ?? AJUSTE_FOTO_INICIAL}
                          nombre={operador.nombre}
                          className="h-11 w-9 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{operador.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cargoOArea} · {operador.activo ? "Activo" : "Inactivo"}
                          </p>
                        </div>
                        <span
                          className={`hidden items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold sm:inline-flex ${
                            completo
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {completo ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {completo ? "Listo" : "Borrador"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            abrirEdicion(operador)
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </article>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => abrirEdicion(operador)}>
                        <Pencil className="text-primary" />
                        <span>Editar gafete y foto</span>
                        <ContextMenuShortcut>↵</ContextMenuShortcut>
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => alternarSeleccion(operador.id)}>
                        {seleccionado ? (
                          <>
                            <Square className="text-amber-600" />
                            <span>Desmarcar para impresión</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="text-emerald-600" />
                            <span>Marcar para impresión</span>
                          </>
                        )}
                      </ContextMenuItem>

                      <ContextMenuSeparator />

                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Copy className="text-muted-foreground" />
                          <span>Copiar información</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          <ContextMenuItem
                            onClick={() => {
                              void copiarAlPortapapeles(operador.nombre, "Nombre copiado")
                            }}
                          >
                            <span>Nombre ({operador.nombre})</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              void copiarAlPortapapeles(areaTexto(operador.area), "Área copiada")
                            }}
                          >
                            <span>Área ({areaTexto(operador.area)})</span>
                          </ContextMenuItem>
                          {perfil?.cargo && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(perfil.cargo, "Cargo copiado")
                              }}
                            >
                              <span>Cargo ({perfil.cargo})</span>
                            </ContextMenuItem>
                          )}
                          {perfil?.rfc && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(perfil.rfc, "RFC copiado")
                              }}
                            >
                              <span>RFC ({perfil.rfc})</span>
                            </ContextMenuItem>
                          )}
                          {perfil?.nss && (
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(perfil.nss, "NSS copiado")
                              }}
                            >
                              <span>NSS ({perfil.nss})</span>
                            </ContextMenuItem>
                          )}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
              {trabajadores.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-5 w-5" />
                  No hay trabajadores que coincidan con la búsqueda.
                </div>
              )}
            </div>
          )}
        </ModuleSurface>
      </div>

      {editando && formulario && (
        <Dialog open onOpenChange={(open) => !open && cerrarEdicion()}>
          <DialogContent className="gafetes-screen flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="border-b border-border px-4 py-4">
              <DialogTitle>Editar gafete</DialogTitle>
              <DialogDescription>Los datos sensibles solo son visibles para super-admin.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[1fr_270px]">
              <div className="grid content-start gap-3 sm:grid-cols-2">
                <Campo label="Nombre">
                  <input
                    value={formulario.nombre}
                    onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <Campo label="Área">
                  <select
                    value={formulario.area}
                    onChange={(e) => setFormulario({ ...formulario, area: e.target.value as Area })}
                    className={CAMPO_GAFETE_CLASS}
                  >
                    {AREAS.map((area) => (
                      <option key={area.value} value={area.value}>
                        {area.label}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Cargo / departamento impreso">
                  <input
                    value={formulario.cargo}
                    onChange={(e) => setFormulario({ ...formulario, cargo: e.target.value })}
                    placeholder="Ej. Asistencia en Diseño y Fabricación"
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <Campo label="Fecha de ingreso">
                  <input
                    type="date"
                    value={formulario.fechaIngreso}
                    onChange={(e) => setFormulario({ ...formulario, fechaIngreso: e.target.value })}
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                  <strong className="text-foreground">Datos institucionales del taller</strong>
                  <span className="ml-1">se aplican a todos los gafetes.</span>
                  <p className="mt-1">{DATOS_TALLER_GAFETES.domicilio}</p>
                  <p>
                    {DATOS_TALLER_GAFETES.responsableNombre} · {DATOS_TALLER_GAFETES.responsablePuesto} ·{" "}
                    {DATOS_TALLER_GAFETES.responsableTelefono}
                  </p>
                </div>
                <Campo label="NSS">
                  <input
                    value={formulario.nss}
                    onChange={(e) => setFormulario({ ...formulario, nss: e.target.value })}
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <Campo label="RFC">
                  <input
                    value={formulario.rfc}
                    onChange={(e) => setFormulario({ ...formulario, rfc: e.target.value.toUpperCase() })}
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <Campo label="Foto" wide>
                  <input
                    id="foto-gafete"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => seleccionarFoto(e.target.files?.[0])}
                  />
                  <label
                    htmlFor="foto-gafete"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                  >
                    <ImagePlus className="h-4 w-4" /> Elegir foto JPG, PNG o WebP
                  </label>
                </Campo>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-3 sm:col-span-2">
                  <Campo label={`Zoom ${formulario.fotoAjuste.zoom.toFixed(2)}×`}>
                    <input
                      type="range"
                      min="0.75"
                      max="2.5"
                      step="0.05"
                      value={formulario.fotoAjuste.zoom}
                      onChange={(e) => actualizarAjuste({ zoom: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </Campo>
                  <Campo label="Rotación">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => actualizarAjuste({ rotacion: formulario.fotoAjuste.rotacion - 90 })}
                        className={AJUSTE_FOTO_CLASS}
                      >
                        <RotateCcw className="h-4 w-4" /> Izq.
                      </button>
                      <button
                        type="button"
                        onClick={() => actualizarAjuste({ rotacion: formulario.fotoAjuste.rotacion + 90 })}
                        className={AJUSTE_FOTO_CLASS}
                      >
                        Der.
                      </button>
                    </div>
                  </Campo>
                  <Campo label="Mover horizontal">
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={formulario.fotoAjuste.desplazamientoX}
                      onChange={(e) => actualizarAjuste({ desplazamientoX: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </Campo>
                  <Campo label="Mover vertical">
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={formulario.fotoAjuste.desplazamientoY}
                      onChange={(e) => actualizarAjuste({ desplazamientoY: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </Campo>
                </div>
              </div>
              <aside className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Vista previa · frente
                </p>
                <div className="origin-top scale-[.85] -mb-14">
                  <CaraGafete
                    item={{
                      operador: {
                        ...editando,
                        nombre: formulario.nombre || editando.nombre,
                        area: formulario.area,
                      },
                      perfil: {
                        ...perfilesPorOperador.get(editando.id),
                        ...formulario,
                        id: editando.id,
                        operadorId: editando.id,
                        creadoEn: perfilesPorOperador.get(editando.id)?.creadoEn ?? new Date(),
                        actualizadoEn: new Date(),
                      },
                    }}
                  />
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  Un perfil se puede guardar como borrador. Para imprimir requiere todos los campos y foto.
                </p>
              </aside>
            </div>
            <DialogFooter className="border-t border-border p-4">
              <Button variant="outline" onClick={cerrarEdicion} disabled={guardando}>Cancelar</Button>
              <Button onClick={guardar} disabled={guardando}>
                <Save />{guardando ? "Guardando…" : "Guardar perfil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="gafete-print-root">
        {hojas.flatMap((hoja, indice) => [
          <HojaImpresion key={`frentes-${indice}`} hoja={hoja} reverso={false} />,
          <HojaImpresion key={`reversos-${indice}`} hoja={hoja} reverso />,
        ])}
      </div>
    </PageShell>
  )
}

function Campo({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1 text-xs font-medium text-foreground ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
