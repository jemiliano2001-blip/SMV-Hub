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
  X,
} from "lucide-react"
import { authBypassActivo, useUsuario } from "@/lib/auth"
import { usePermisos } from "@/lib/hooks/useRol"
import { useOperadores } from "@/lib/hooks/useOperadores"
import { actualizarOperador } from "@/lib/operadores"
import {
  AJUSTE_FOTO_INICIAL,
  agruparGafetesParaImpresion,
  estaCompletoGafete,
  listarGafetes,
  MEDIDAS_GAFETE_PULGADAS,
  normalizarAjusteFoto,
  guardarGafete,
  type GafetePerfilPayload,
} from "@/lib/gafetes"
import { cargarFotoGafete, subirFotoGafete } from "@/lib/storage"
import type { Area, GafeteAjusteFoto, GafetePerfil, Operador } from "@/lib/schemas"

const AREAS: { value: Area; label: string }[] = [
  { value: "taller", label: "Taller" },
  { value: "diseno", label: "Diseño" },
  { value: "automatizacion", label: "Automatización" },
  { value: "cnc", label: "CNC" },
  { value: "limpieza", label: "Limpieza" },
  { value: "administracion", label: "Administración" },
]

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
    domicilio: perfil?.domicilio ?? "",
    responsableNombre: perfil?.responsableNombre ?? "",
    responsablePuesto: perfil?.responsablePuesto ?? "",
    responsableTelefono: perfil?.responsableTelefono ?? "",
    fechaIngreso: perfil?.fechaIngreso ?? "",
    nss: perfil?.nss ?? "",
    rfc: perfil?.rfc ?? "",
    fotoUrl: "",
    fotoPath: perfil?.fotoPath ?? "",
    fotoAjuste: normalizarAjusteFoto(perfil?.fotoAjuste ?? AJUSTE_FOTO_INICIAL),
  }
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
        <div className="gafete-marca">SMV</div>
        <p className="gafete-eyebrow">RESPONSABLE</p>
        <p className="gafete-responsable">{perfil.responsableNombre}</p>
        <p className="gafete-puesto">{perfil.responsablePuesto}</p>
        <p className="gafete-telefono">{perfil.responsableTelefono}</p>
        <div className="gafete-datos-legales">
          <p><strong>Fecha de ingreso:</strong> {perfil.fechaIngreso}</p>
          <p><strong>NSS:</strong> {perfil.nss}</p>
          <p><strong>RFC:</strong> {perfil.rfc}</p>
        </div>
        <div className="gafete-pie">SMV · Identificación de personal</div>
      </article>
    )
  }

  return (
    <article className="gafete-card gafete-frente" aria-label={`Frente de gafete de ${operador.nombre}`}>
      <div className="gafete-marca">SMV</div>
      <div className="gafete-foto-marco">
        <FotoGafete url={(perfil as GafetePerfilVista).fotoUrl ?? ""} ajuste={perfil.fotoAjuste} nombre={operador.nombre} className="h-full w-full" />
      </div>
      <h2 className="gafete-nombre">{operador.nombre}</h2>
      <p className="gafete-cargo">{perfil.cargo || areaTexto(operador.area)}</p>
      <div className="gafete-linea" />
      <p className="gafete-domicilio">{perfil.domicilio}</p>
      <div className="gafete-pie">PERSONAL SMV</div>
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
        domicilio: formulario.domicilio.trim(),
        responsableNombre: formulario.responsableNombre.trim(),
        responsablePuesto: formulario.responsablePuesto.trim(),
        responsableTelefono: formulario.responsableTelefono.trim(),
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
    <main className="min-h-screen bg-[#F8FAFC] font-sans gafetes-page">
      <style>{`
        .gafete-card { width: ${MEDIDAS_GAFETE_PULGADAS.ancho}in; height: ${MEDIDAS_GAFETE_PULGADAS.alto}in; position: relative; overflow: hidden; color: white; background: radial-gradient(circle at 72% 22%, #0b84d7 0, #075697 30%, #082852 76%, #061936 100%); box-shadow: 0 10px 25px rgba(15, 23, 42, .25); font-family: Arial, sans-serif; }
        .gafete-card::before { content: ''; position: absolute; width: 5in; height: 5in; border: .75pt solid rgba(125, 211, 252, .4); transform: rotate(42deg); top: -2.4in; right: -2.4in; box-shadow: 0 0 0 .13in rgba(14, 165, 233, .06), 0 0 0 .27in rgba(14, 165, 233, .05); }
        .gafete-marca { position: absolute; top: .18in; left: .18in; z-index: 1; font-size: .23in; font-weight: 900; letter-spacing: .035in; }
        .gafete-frente { display: flex; flex-direction: column; align-items: center; padding: .56in .2in .18in; text-align: center; }
        .gafete-foto-marco { position: relative; z-index: 1; width: 1.26in; height: 1.52in; border: .03in solid white; border-radius: .08in; overflow: hidden; background: #e2e8f0; box-shadow: 0 .04in .13in rgba(0,0,0,.28); }
        .gafete-nombre { position: relative; z-index: 1; width: 100%; margin: .17in 0 .04in; font-size: .20in; line-height: 1.05; font-weight: 800; text-transform: uppercase; }
        .gafete-cargo { position: relative; z-index: 1; margin: 0; max-width: 2.05in; font-size: .105in; font-weight: 600; line-height: 1.25; min-height: .27in; }
        .gafete-linea { position: relative; z-index: 1; width: 1.75in; height: .012in; margin: .08in 0 .12in; background: rgba(255,255,255,.9); }
        .gafete-domicilio { position: relative; z-index: 1; margin: 0; width: 2.04in; font-size: .083in; line-height: 1.35; }
        .gafete-pie { position: absolute; z-index: 1; bottom: .13in; left: .18in; right: .18in; font-size: .07in; font-weight: 700; letter-spacing: .025in; text-align: center; opacity: .95; }
        .gafete-reverso { padding: .78in .25in .18in; }
        .gafete-eyebrow { position: relative; z-index: 1; margin: 0 0 .09in; color: #bae6fd; font-size: .08in; font-weight: 800; letter-spacing: .025in; }
        .gafete-responsable { position: relative; z-index: 1; margin: 0; font-size: .19in; line-height: 1.1; font-weight: 800; }
        .gafete-puesto { position: relative; z-index: 1; margin: .07in 0 0; font-size: .10in; font-weight: 600; line-height: 1.25; }
        .gafete-telefono { position: relative; z-index: 1; margin: .06in 0 0; font-size: .12in; font-weight: 800; }
        .gafete-datos-legales { position: absolute; z-index: 1; left: .25in; right: .25in; bottom: .45in; border-top: .012in solid rgba(255,255,255,.7); padding-top: .14in; font-size: .092in; line-height: 1.55; }
        .gafete-datos-legales p { margin: 0; }
        .gafete-print-root { display: none; }
        .campo-gafete { width: 100%; border: 1px solid #cbd5e1; border-radius: .5rem; padding: .48rem .62rem; font-size: .875rem; color: #0f172a; outline: none; background: white; }
        .campo-gafete:focus { border-color: #0369a1; box-shadow: 0 0 0 2px #e0f2fe; }
        .ajuste-foto { display: inline-flex; align-items: center; gap: .25rem; border: 1px solid #cbd5e1; border-radius: .45rem; background: white; padding: .4rem .55rem; font-size: .75rem; font-weight: 700; color: #334155; }
        .ajuste-foto:hover { background: #f8fafc; }
        @media print { @page { size: letter portrait; margin: 0; } header, .gafetes-screen { display: none !important; } .gafete-print-root { display: block !important; } .gafete-print-sheet { width: 8.5in; height: 11in; display: grid; grid-template-columns: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.ancho}in); grid-template-rows: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.alto}in); column-gap: .26in; row-gap: .26in; padding: 1.568in 1.658in; box-sizing: border-box; break-after: page; page-break-after: always; } .gafete-print-sheet:last-child { break-after: auto; page-break-after: auto; } .gafete-print-cell { position: relative; } .gafete-crop { position: absolute; width: .09in; height: .09in; border-color: #111; border-style: solid; } .gafete-crop-tl { left: -.06in; top: -.06in; border-width: .01in 0 0 .01in; } .gafete-crop-tr { right: -.06in; top: -.06in; border-width: .01in .01in 0 0; } .gafete-crop-bl { left: -.06in; bottom: -.06in; border-width: 0 0 .01in .01in; } .gafete-crop-br { right: -.06in; bottom: -.06in; border-width: 0 .01in .01in 0; } }
      `}</style>

      <div className="gafetes-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <section className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Gafetes de personal</h1>
              <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">PRIVADO · SUPER-ADMIN</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Perfiles vinculados al Personal Maestro e impresión a doble cara en tamaño real.</p>
          </div>
          <button onClick={imprimir} disabled={imprimibles.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0369A1] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#075985] disabled:cursor-not-allowed disabled:opacity-45 transition-colors">
            <Printer className="h-4 w-4" /> Imprimir {imprimibles.length || ""} gafete{imprimibles.length === 1 ? "" : "s"}
          </button>
        </section>

        <section className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-xs text-sky-900">
          <strong>Impresión:</strong> elige “Tamaño real” o 100%, papel Carta, doble cara y <strong>voltear por borde largo</strong>. Cada frente y reverso se colocan en la misma posición y mide {MEDIDAS_GAFETE_PULGADAS.ancho} × {MEDIDAS_GAFETE_PULGADAS.alto} pulgadas.
        </section>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>}

        <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <label className="relative block max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar trabajador, área o cargo…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0369A1] focus:ring-2 focus:ring-sky-100" />
            </label>
            <p className="text-xs text-slate-500"><strong>{imprimibles.length}</strong> completos listos para imprimir · {seleccionados.length - imprimibles.length > 0 ? `${seleccionados.length - imprimibles.length} borrador(es) excluido(s)` : ""}</p>
          </div>

          {cargando ? <div className="p-8 text-center text-sm text-slate-500">Cargando personal y perfiles…</div> : (
            <div className="divide-y divide-slate-100">
              {trabajadores.map((operador) => {
                const perfil = perfilesPorOperador.get(operador.id)
                const completo = estaListoParaImprimir(perfil)
                const seleccionado = seleccionados.includes(operador.id)
                return (
                  <article key={operador.id} className={`flex gap-3 items-center p-3 sm:px-4 ${!operador.activo ? "opacity-55" : ""}`}>
                    <input aria-label={`Seleccionar ${operador.nombre} para imprimir`} type="checkbox" checked={seleccionado} onChange={() => alternarSeleccion(operador.id)} className="h-4 w-4 accent-[#0369A1] shrink-0" />
                    <FotoGafete url={perfil?.fotoUrl ?? ""} ajuste={perfil?.fotoAjuste ?? AJUSTE_FOTO_INICIAL} nombre={operador.nombre} className="h-11 w-9 rounded-md shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 truncate">{operador.nombre}</p>
                      <p className="text-xs text-slate-500 truncate">{perfil?.cargo || areaTexto(operador.area)} · {operador.activo ? "Activo" : "Inactivo"}</p>
                    </div>
                    <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold border ${completo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                      {completo ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {completo ? "Listo" : "Borrador"}
                    </span>
                    <button onClick={() => abrirEdicion(operador)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  </article>
                )
              })}
              {trabajadores.length === 0 && <div className="p-8 text-center text-sm text-slate-500"><Users className="h-5 w-5 mx-auto mb-2" />No hay trabajadores que coincidan con la búsqueda.</div>}
            </div>
          )}
        </section>
      </div>

      {editando && formulario && (
        <div className="gafetes-screen fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
          <div className="mx-auto max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div><h2 className="font-bold text-slate-900">Editar gafete</h2><p className="text-xs text-slate-500">Los datos sensibles solo son visibles para super-admin.</p></div>
              <button onClick={cerrarEdicion} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid lg:grid-cols-[1fr_270px] gap-6 p-4 sm:p-5">
              <div className="grid sm:grid-cols-2 gap-3 content-start">
                <Campo label="Nombre"><input value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="Área"><select value={formulario.area} onChange={(e) => setFormulario({ ...formulario, area: e.target.value as Area })} className="campo-gafete">{AREAS.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></Campo>
                <Campo label="Cargo / departamento impreso"><input value={formulario.cargo} onChange={(e) => setFormulario({ ...formulario, cargo: e.target.value })} placeholder="Ej. Asistencia en Diseño y Fabricación" className="campo-gafete" /></Campo>
                <Campo label="Fecha de ingreso"><input type="date" value={formulario.fechaIngreso} onChange={(e) => setFormulario({ ...formulario, fechaIngreso: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="Domicilio" wide><textarea value={formulario.domicilio} onChange={(e) => setFormulario({ ...formulario, domicilio: e.target.value })} rows={2} className="campo-gafete resize-none" /></Campo>
                <Campo label="Responsable"><input value={formulario.responsableNombre} onChange={(e) => setFormulario({ ...formulario, responsableNombre: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="Puesto del responsable"><input value={formulario.responsablePuesto} onChange={(e) => setFormulario({ ...formulario, responsablePuesto: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="Teléfono del responsable"><input value={formulario.responsableTelefono} onChange={(e) => setFormulario({ ...formulario, responsableTelefono: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="NSS"><input value={formulario.nss} onChange={(e) => setFormulario({ ...formulario, nss: e.target.value })} className="campo-gafete" /></Campo>
                <Campo label="RFC"><input value={formulario.rfc} onChange={(e) => setFormulario({ ...formulario, rfc: e.target.value.toUpperCase() })} className="campo-gafete" /></Campo>
                <Campo label="Foto" wide>
                  <input id="foto-gafete" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => seleccionarFoto(e.target.files?.[0])} />
                  <label htmlFor="foto-gafete" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"><ImagePlus className="h-4 w-4" /> Elegir foto JPG, PNG o WebP</label>
                </Campo>
                <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Campo label={`Zoom ${formulario.fotoAjuste.zoom.toFixed(2)}×`}><input type="range" min="0.75" max="2.5" step="0.05" value={formulario.fotoAjuste.zoom} onChange={(e) => actualizarAjuste({ zoom: Number(e.target.value) })} className="w-full accent-[#0369A1]" /></Campo>
                  <Campo label="Rotación"><div className="flex gap-2"><button type="button" onClick={() => actualizarAjuste({ rotacion: formulario.fotoAjuste.rotacion - 90 })} className="ajuste-foto"><RotateCcw className="h-4 w-4" /> Izq.</button><button type="button" onClick={() => actualizarAjuste({ rotacion: formulario.fotoAjuste.rotacion + 90 })} className="ajuste-foto">Der.</button></div></Campo>
                  <Campo label="Mover horizontal"><input type="range" min="-50" max="50" value={formulario.fotoAjuste.desplazamientoX} onChange={(e) => actualizarAjuste({ desplazamientoX: Number(e.target.value) })} className="w-full accent-[#0369A1]" /></Campo>
                  <Campo label="Mover vertical"><input type="range" min="-50" max="50" value={formulario.fotoAjuste.desplazamientoY} onChange={(e) => actualizarAjuste({ desplazamientoY: Number(e.target.value) })} className="w-full accent-[#0369A1]" /></Campo>
                </div>
              </div>
              <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista previa · frente</p>
                <div className="origin-top scale-[.85] -mb-14"><CaraGafete item={{ operador: { ...editando, nombre: formulario.nombre || editando.nombre, area: formulario.area }, perfil: { ...perfilesPorOperador.get(editando.id), ...formulario, id: editando.id, operadorId: editando.id, creadoEn: perfilesPorOperador.get(editando.id)?.creadoEn ?? new Date(), actualizadoEn: new Date() } }} /></div>
                <p className="text-center text-[11px] text-slate-500">Un perfil se puede guardar como borrador. Para imprimir requiere todos los campos y foto.</p>
              </aside>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button onClick={cerrarEdicion} disabled={guardando} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button><button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-2 rounded-lg bg-[#0369A1] px-3 py-2 text-xs font-bold text-white hover:bg-[#075985] disabled:opacity-60"><Save className="h-4 w-4" />{guardando ? "Guardando…" : "Guardar perfil"}</button></div>
          </div>
        </div>
      )}

      <div className="gafete-print-root">
        {hojas.flatMap((hoja, indice) => [
          <HojaImpresion key={`frentes-${indice}`} hoja={hoja} reverso={false} />,
          <HojaImpresion key={`reversos-${indice}`} hoja={hoja} reverso />,
        ])}
      </div>
    </main>
  )
}

function Campo({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`grid gap-1 text-xs font-medium text-slate-700 ${wide ? "sm:col-span-2" : ""}`}><span>{label}</span>{children}</label>
}
