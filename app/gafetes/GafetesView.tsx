"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Copy,
  ImagePlus,
  Layers,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Search,
  Square,
  Users,
} from "lucide-react"
import { copiarAlPortapapeles } from "@/lib/portapapeles"
import { authBypassActivo, useUsuario } from "@/lib/auth"
import { usePermisos } from "@/lib/hooks/useRol"
import { useOperadores } from "@/lib/hooks/useOperadores"
import { actualizarOperador } from "@/lib/operadores"
import {
  AJUSTE_FOTO_INICIAL,
  agruparGafetesParaEnmicar,
  agruparGafetesParaImpresion,
  DATOS_TALLER_GAFETES,
  estaCompletoGafete,
  formatearFechaIngresoGafete,
  guardarGafete,
  listarGafetes,
  MEDIDAS_GAFETE_PULGADAS,
  normalizarAjusteFoto,
  type GafetePerfilPayload,
} from "@/lib/gafetes"
import { fechaHoyLocal } from "@/lib/format"
import { imprimirComoDocumento } from "@/lib/imprimir-documento"
import { cargarFotoGafete, subirFotoGafete } from "@/lib/storage"
import { Area, GafeteAjusteFoto, GafetePerfil, Operador } from "@/lib/schemas"
import { construirPayloadQROperador } from "@/lib/gafetes-qr"
import { generarQRSVG } from "@/lib/qr"
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
} from "@/components/ui/context-menu"
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
type ModoImpresion = "enmicado" | "duplex"

function estaListoParaImprimir(perfil: GafetePerfilVista | null | undefined): perfil is GafetePerfilVista {
  return estaCompletoGafete(perfil) && Boolean(perfil.fotoUrl)
}

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
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

/** Logotipo institucional idéntico al gafete físico original */
function LogoGafete() {
  return (
    <div className="gafete-logo-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/smv-logo.png" alt="SMV" className="gafete-logo-img" />
      <p className="gafete-logo-sub1">SERVICIOS Y MAQUINADOS</p>
      <p className="gafete-logo-sub2">— VAZQUEZ —</p>
    </div>
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
      <div className={`flex items-center justify-center bg-slate-300 text-slate-600 font-black ${className}`}>
        {iniciales(nombre)}
      </div>
    )
  }
  return (
    <div className={`overflow-hidden bg-slate-300 ${className}`}>
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
  const qrSvg = generarQRSVG(construirPayloadQROperador(operador), 72)

  if (reverso) {
    return (
      <article className="gafete-card gafete-reverso" aria-label={`Reverso de gafete de ${operador.nombre}`}>
        <LogoGafete />

        <div className="gafete-reverso-datos">
          <p>
            <span className="font-normal">Fecha de Ingreso: </span>
            <span className="font-semibold">{formatearFechaIngresoGafete(perfil.fechaIngreso)}</span>
          </p>
          <p>
            <span className="font-normal">NSS: </span>
            <span className="font-semibold">{perfil.nss}</span>
          </p>
          <p>
            <span className="font-normal">RFC: </span>
            <span className="font-semibold">{perfil.rfc}</span>
          </p>
        </div>

        <div className="gafete-reverso-responsable">
          <p className="gafete-resp-titulo">{DATOS_TALLER_GAFETES.responsableTitulo}</p>
          <p className="gafete-resp-puesto">{DATOS_TALLER_GAFETES.responsablePuesto}</p>
          <p className="gafete-resp-nombre">{DATOS_TALLER_GAFETES.responsableNombre}</p>
          <p className="gafete-resp-tel">{DATOS_TALLER_GAFETES.responsableTelefono}</p>
        </div>

        <div className="gafete-qr-wrap">
          <div
            className="gafete-qr-marco"
            title={`Código QR de ${operador.nombre}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>
      </article>
    )
  }

  return (
    <article className="gafete-card gafete-frente" aria-label={`Frente de gafete de ${operador.nombre}`}>
      <LogoGafete />

      <div className="gafete-foto-marco">
        <FotoGafete
          url={(perfil as GafetePerfilVista).fotoUrl ?? ""}
          ajuste={perfil.fotoAjuste}
          nombre={operador.nombre}
          className="h-full w-full"
        />
      </div>

      <h2 className="gafete-nombre">{operador.nombre}</h2>

      <div className="gafete-linea-blanca" />

      <p className="gafete-cargo">{perfil.cargo || areaTexto(operador.area)}</p>

      <div className="gafete-domicilio-bloque">
        <p>{DATOS_TALLER_GAFETES.domicilioLinea1}</p>
        <p>{DATOS_TALLER_GAFETES.domicilioLinea2}</p>
        <p>{DATOS_TALLER_GAFETES.domicilioLinea3}</p>
      </div>
    </article>
  )
}

/** Hoja para modo Enmicado: pares de [Frente | Reverso] lado a lado con marcas de corte */
function HojaEnmicado({ hoja }: { hoja: GafeteListo[] }) {
  return (
    <section className="gafete-print-sheet-enmicado">
      {hoja.map((item) => (
        <div key={item.operador.id} className="gafete-par-enmicado">
          <div className="gafete-par-contenedor">
            <CaraGafete item={item} reverso={false} />
            <div className="gafete-guia-doblez" />
            <CaraGafete item={item} reverso={true} />
            <span className="gafete-crop gafete-crop-tl" />
            <span className="gafete-crop gafete-crop-tr" />
            <span className="gafete-crop gafete-crop-bl" />
            <span className="gafete-crop gafete-crop-br" />
          </div>
        </div>
      ))}
    </section>
  )
}

/** Hoja para modo Dúplex: 4 caras por hoja */
function HojaDuplex({ hoja, reverso }: { hoja: GafeteListo[]; reverso: boolean }) {
  return (
    <section className="gafete-print-sheet-duplex">
      {hoja.map((item) => (
        <div key={item.operador.id} className="gafete-duplex-cell">
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
  const [vistaModal, setVistaModal] = useState<"frente" | "reverso">("frente")
  const [modoImpresion, setModoImpresion] = useState<ModoImpresion>("enmicado")
  const [gafetesAImprimir, setGafetesAImprimir] = useState<GafeteListo[] | null>(null)

  const perfilesPorOperador = useMemo(
    () => new Map(perfiles.map((perfil) => [perfil.operadorId, perfil])),
    [perfiles]
  )

  async function cargarPerfiles() {
    setCargandoPerfiles(true)
    setError(null)
    try {
      const perfilesPrivados = await listarGafetes()
      const conFotos = await Promise.all(
        perfilesPrivados.map(async (perfil) => ({
          ...perfil,
          fotoUrl: await cargarFotoGafete(perfil.fotoPath).catch(() => ""),
        }))
      )
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
      return [operador.nombre, areaTexto(operador.area), perfil?.cargo ?? ""].some((valor) =>
        valor.toLocaleLowerCase("es").includes(q)
      )
    })
  }, [busqueda, operadores, perfilesPorOperador])

  const imprimiblesSeleccionados = useMemo<GafeteListo[]>(() => {
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
    setVistaModal("frente")
  }

  function cerrarEdicion() {
    setEditando(null)
    setFormulario(null)
    setFotoNueva(null)
  }

  function actualizarAjuste(
    cambios: Partial<{ rotacion: number; zoom: number; desplazamientoX: number; desplazamientoY: number }>
  ) {
    setFormulario((actual) =>
      actual
        ? {
            ...actual,
            fotoAjuste: normalizarAjusteFoto({ ...actual.fotoAjuste, ...cambios }),
          }
        : actual
    )
  }

  function seleccionarFoto(file: File | undefined) {
    if (!file || !formulario) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size >= 10 * 1024 * 1024) {
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
    const duplicado = operadores.some(
      (op) => op.id !== editando.id && op.nombre.trim().toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es")
    )
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
      await guardarGafete(
        {
          operadorId: editando.id,
          cargo: formulario.cargo.trim(),
          fechaIngreso: formulario.fechaIngreso,
          nss: formulario.nss.trim(),
          rfc: formulario.rfc.trim().toUpperCase(),
          fotoPath,
          fotoAjuste: formulario.fotoAjuste,
        },
        perfilAnterior?.creadoEn
      )
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
    setSeleccionados((actual) => (actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id]))
  }

  function alternarTodos() {
    const listosIds = trabajadores
      .filter((op) => estaListoParaImprimir(perfilesPorOperador.get(op.id)))
      .map((op) => op.id)

    const todosSeleccionados = listosIds.length > 0 && listosIds.every((id) => seleccionados.includes(id))
    if (todosSeleccionados) {
      setSeleccionados([])
    } else {
      setSeleccionados(listosIds)
    }
  }

  function ejecutarImpresion(lista: GafeteListo[], titulo: string) {
    setGafetesAImprimir(lista)
    setTimeout(() => {
      imprimirComoDocumento(titulo)
    }, 50)
  }

  function imprimirLote() {
    if (imprimiblesSeleccionados.length === 0) {
      setError("Selecciona al menos un gafete completo para imprimir.")
      return
    }
    ejecutarImpresion(
      imprimiblesSeleccionados,
      `Gafetes_SMV_${imprimiblesSeleccionados.length}_${fechaHoyLocal()}`
    )
  }

  function imprimirIndividual(operador: Operador, perfil: GafetePerfilVista) {
    ejecutarImpresion([{ operador, perfil }], `Gafete_SMV_${operador.nombre.replace(/\s+/g, "_")}_${fechaHoyLocal()}`)
  }

  const listaFinalImpresion = gafetesAImprimir ?? imprimiblesSeleccionados
  const hojasEnmicado = useMemo(() => agruparGafetesParaEnmicar(listaFinalImpresion), [listaFinalImpresion])
  const hojasDuplex = useMemo(() => agruparGafetesParaImpresion(listaFinalImpresion), [listaFinalImpresion])
  const cargando = cargandoPermisos || cargandoOperadores || cargandoPerfiles

  return (
    <PageShell
      className="gafetes-page"
      printClassName="print:bg-white"
      innerClassName="print:max-w-none print:px-0 print:py-0 print:gap-0"
    >
      <style>{`
        /* =========================================
           DISEÑO FÍSICO EXACTO DEL GAFETE SMV
           ========================================= */
        .gafete-card {
          width: ${MEDIDAS_GAFETE_PULGADAS.ancho}in;
          height: ${MEDIDAS_GAFETE_PULGADAS.alto}in;
          position: relative;
          overflow: hidden;
          color: #111827;
          background: #94979e linear-gradient(135deg, #8c8f95 0%, #a4a8ae 35%, #94979e 65%, #888b91 100%);
          box-shadow: 0 8px 20px rgba(15, 23, 42, .18);
          font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          user-select: none;
        }

        /* Destellos y líneas metálicas cepilladas */
        .gafete-card::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 88% 22%, rgba(255, 255, 255, 0.48) 0%, transparent 55%),
            radial-gradient(ellipse at 12% 88%, rgba(255, 255, 255, 0.32) 0%, transparent 45%),
            repeating-linear-gradient(115deg, transparent 0, transparent 0.06in, rgba(255, 255, 255, 0.09) 0.06in, rgba(255, 255, 255, 0.09) 0.07in);
        }

        .gafete-card::after {
          content: '';
          position: absolute;
          top: 18%;
          left: -25%;
          width: 150%;
          height: 65%;
          border-radius: 50%;
          border-top: 1.6pt solid rgba(255, 255, 255, 0.45);
          border-bottom: 1.2pt solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 0 0.15in rgba(255, 255, 255, 0.35);
          transform: rotate(-24deg);
          pointer-events: none;
          z-index: 0;
        }

        /* Logotipo institucional */
        .gafete-logo-wrap {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-top: 0.14in;
          margin-bottom: 0.04in;
        }
        .gafete-logo-img {
          width: 1.48in;
          height: auto;
          object-fit: contain;
          filter: brightness(0) saturate(100%) invert(20%) sepia(85%) saturate(1980%) hue-rotate(192deg) brightness(85%) contrast(102%);
        }
        .gafete-logo-sub1 {
          margin: 0.02in 0 0;
          font-size: 0.074in;
          font-weight: 800;
          color: #0f4c81;
          letter-spacing: 0.016in;
          line-height: 1;
        }
        .gafete-logo-sub2 {
          margin: 0.01in 0 0;
          font-size: 0.090in;
          font-weight: 800;
          color: #0f4c81;
          letter-spacing: 0.024in;
          line-height: 1;
        }

        /* Frente */
        .gafete-frente {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.10in 0.15in 0.14in;
          text-align: center;
        }
        .gafete-foto-marco {
          position: relative;
          z-index: 1;
          width: 1.15in;
          height: 1.44in;
          border: 1px solid rgba(0, 0, 0, 0.18);
          overflow: hidden;
          background: #cbd5e1;
          box-shadow: 0 0.02in 0.08in rgba(0, 0, 0, 0.18);
          margin-top: 0.05in;
          margin-bottom: 0.05in;
        }
        .gafete-nombre {
          position: relative;
          z-index: 1;
          width: 100%;
          margin: 0.03in 0 0.02in;
          font-size: 0.135in;
          line-height: 1.15;
          font-weight: 700;
          color: #111827;
        }
        .gafete-linea-blanca {
          position: relative;
          z-index: 1;
          width: 2.05in;
          height: 0.032in;
          margin: 0.03in auto 0.04in;
          background: #ffffff;
          border-radius: 1px;
        }
        .gafete-cargo {
          position: relative;
          z-index: 1;
          margin: 0;
          max-width: 2.15in;
          font-size: 0.098in;
          font-weight: 600;
          line-height: 1.25;
          color: #111827;
        }
        .gafete-domicilio-bloque {
          position: absolute;
          z-index: 1;
          bottom: 0.12in;
          left: 0.10in;
          right: 0.10in;
          text-align: center;
          font-size: 0.076in;
          line-height: 1.25;
          font-weight: 500;
          color: #1f2937;
        }
        .gafete-domicilio-bloque p {
          margin: 0;
        }

        /* Reverso */
        .gafete-reverso {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.10in 0.15in 0.14in;
          text-align: center;
        }
        .gafete-reverso-datos {
          position: relative;
          z-index: 1;
          margin-top: 0.12in;
          font-size: 0.096in;
          line-height: 1.45;
          color: #111827;
          text-align: center;
        }
        .gafete-reverso-datos p {
          margin: 0;
        }
        .gafete-reverso-responsable {
          position: relative;
          z-index: 1;
          margin-top: 0.18in;
          font-size: 0.092in;
          line-height: 1.35;
          color: #111827;
          text-align: center;
        }
        .gafete-reverso-responsable p {
          margin: 0;
        }
        .gafete-resp-titulo {
          font-weight: 600;
          margin-bottom: 0.02in !important;
        }
        .gafete-resp-puesto {
          font-weight: 500;
        }
        .gafete-resp-nombre {
          font-weight: 600;
        }
        .gafete-resp-tel {
          font-weight: 600;
        }
        .gafete-qr-wrap {
          position: absolute;
          z-index: 1;
          bottom: 0.16in;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
        }
        .gafete-qr-marco {
          width: 0.72in;
          height: 0.72in;
          padding: 0.03in;
          background: #ffffff;
          border-radius: 2px;
          box-shadow: 0 0.02in 0.06in rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gafete-qr-marco svg {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }

        /* Impresión */
        .gafete-print-root {
          display: none;
        }

        @media print {
          @page {
            size: letter portrait;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, .gafetes-screen {
            display: none !important;
          }
          .gafete-print-root {
            display: block !important;
          }

          /* MODO ENMICADO (1 sola hoja, Frente y Reverso lado a lado) */
          .gafete-print-sheet-enmicado {
            width: 8.5in;
            height: 11in;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 0.45in;
            box-sizing: border-box;
            break-after: page;
            page-break-after: always;
          }
          .gafete-print-sheet-enmicado:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .gafete-par-enmicado {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .gafete-par-contenedor {
            position: relative;
            display: flex;
            flex-direction: row;
            align-items: center;
          }
          .gafete-guia-doblez {
            width: 0;
            height: ${MEDIDAS_GAFETE_PULGADAS.alto}in;
            border-left: 1px dashed rgba(0, 0, 0, 0.4);
            z-index: 10;
          }

          /* MODO DÚPLEX (2 páginas por lote) */
          .gafete-print-sheet-duplex {
            width: 8.5in;
            height: 11in;
            display: grid;
            grid-template-columns: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.ancho}in);
            grid-template-rows: repeat(2, ${MEDIDAS_GAFETE_PULGADAS.alto}in);
            column-gap: 0.26in;
            row-gap: 0.26in;
            padding: 1.568in 1.658in;
            box-sizing: border-box;
            break-after: page;
            page-break-after: always;
          }
          .gafete-print-sheet-duplex:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .gafete-duplex-cell {
            position: relative;
          }

          /* Crop marks */
          .gafete-crop {
            position: absolute;
            width: 0.12in;
            height: 0.12in;
            border-color: #111;
            border-style: solid;
            pointer-events: none;
            z-index: 20;
          }
          .gafete-crop-tl {
            left: -0.06in;
            top: -0.06in;
            border-width: 0.012in 0 0 0.012in;
          }
          .gafete-crop-tr {
            right: -0.06in;
            top: -0.06in;
            border-width: 0.012in 0.012in 0 0;
          }
          .gafete-crop-bl {
            left: -0.06in;
            bottom: -0.06in;
            border-width: 0 0 0.012in 0.012in;
          }
          .gafete-crop-br {
            right: -0.06in;
            bottom: -0.06in;
            border-width: 0 0.012in 0.012in 0;
          }
        }
      `}</style>

      <div className="gafetes-screen flex flex-col gap-4">
        <PageHeader
          title="Gafetes de personal"
          badge="Super-admin"
          icon={Users}
          description="Diseño institucional del taller y generación de gafetes listos para enmicar o imprimir a doble cara."
          className="print:hidden"
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setModoImpresion("enmicado")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    modoImpresion === "enmicado"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Imprime frente y reverso juntos en la misma hoja (ideal para doblar y plastificar)"
                >
                  <Layers className="h-3.5 w-3.5" />
                  1 Hoja (Enmicar)
                </button>
                <button
                  type="button"
                  onClick={() => setModoImpresion("duplex")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    modoImpresion === "duplex"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Imprime frentes en Pág 1 y reversos en Pág 2 (para impresoras automáticas doble cara)"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Doble Cara (Dúplex)
                </button>
              </div>

              <Button size="sm" onClick={imprimirLote} disabled={imprimiblesSeleccionados.length === 0}>
                <Printer data-icon="inline-start" />
                Imprimir {imprimiblesSeleccionados.length || ""} gafete
                {imprimiblesSeleccionados.length === 1 ? "" : "s"}
              </Button>
            </div>
          }
        />

        <section className="flex flex-col gap-1 rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="text-foreground">Modo activo:</strong>{" "}
            {modoImpresion === "enmicado" ? (
              <span>
                <strong className="text-foreground">1 Hoja para Enmicar</strong> · Frente y Reverso lado a lado con línea
                de doblado central para recortar y enmicar en 1 solo paso.
              </span>
            ) : (
              <span>
                <strong className="text-foreground">Doble Cara</strong> · Hoja 1: Frentes, Hoja 2: Reversos centrados
                para impresoras dúplex.
              </span>
            )}
          </div>
          <div className="shrink-0 text-muted-foreground">
            Medida real: {MEDIDAS_GAFETE_PULGADAS.ancho} × {MEDIDAS_GAFETE_PULGADAS.alto} in
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <ModuleSurface>
          <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={alternarTodos} className="text-xs">
                {imprimiblesSeleccionados.length > 0 &&
                imprimiblesSeleccionados.length ===
                  trabajadores.filter((op) => estaListoParaImprimir(perfilesPorOperador.get(op.id))).length ? (
                  <>
                    <Square className="h-3.5 w-3.5" /> Desmarcar todos
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" /> Marcar listos ({trabajadores.filter((op) => estaListoParaImprimir(perfilesPorOperador.get(op.id))).length})
                  </>
                )}
              </Button>
              <label className="relative block w-full max-w-xs sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar trabajador, área o cargo…"
                  className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{imprimiblesSeleccionados.length}</strong> seleccionados para imprimir
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
                        className={`flex cursor-pointer select-none items-center gap-3 p-3 transition-colors hover:bg-muted/60 sm:px-4 ${
                          !operador.activo ? "opacity-55" : ""
                        }`}
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
                          className="h-11 w-9 shrink-0 rounded-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{operador.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {cargoOArea} · {operador.activo ? "Activo" : "Inactivo"}
                            {perfil?.fechaIngreso && (
                              <span className="hidden sm:inline">
                                {" "}
                                · Ingreso: {formatearFechaIngresoGafete(perfil.fechaIngreso)}
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`hidden items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold sm:inline-flex ${
                            completo
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {completo ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {completo ? "Listo" : "Incompleto"}
                        </span>

                        <div className="flex items-center gap-2">
                          {completo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                imprimirIndividual(operador, perfil)
                              }}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                              title="Imprimir solo este gafete en 1 hoja"
                            >
                              <Printer className="h-3.5 w-3.5 text-primary" />
                              <span className="hidden sm:inline">Imprimir</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirEdicion(operador)
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                        </div>
                      </article>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuItem onClick={() => abrirEdicion(operador)}>
                        <Pencil className="text-primary" />
                        <span>Editar datos y foto</span>
                        <ContextMenuShortcut>↵</ContextMenuShortcut>
                      </ContextMenuItem>

                      {completo && (
                        <ContextMenuItem onClick={() => imprimirIndividual(operador, perfil)}>
                          <Printer className="text-primary" />
                          <span>Imprimir este gafete</span>
                        </ContextMenuItem>
                      )}

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
              <DialogTitle>Editar gafete de {formulario.nombre || editando.nombre}</DialogTitle>
              <DialogDescription>
                Los datos privados (NSS, RFC, Ingreso) son de uso exclusivo para el gafete físico del taller.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[1fr_310px]">
              <div className="grid content-start gap-3 sm:grid-cols-2">
                <Campo label="Nombre del trabajador">
                  <input
                    value={formulario.nombre}
                    onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                    className={CAMPO_GAFETE_CLASS}
                    placeholder="Nombre completo"
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
                <Campo label="Cargo / Departamento impreso">
                  <input
                    value={formulario.cargo}
                    onChange={(e) => setFormulario({ ...formulario, cargo: e.target.value })}
                    placeholder="Ej. Asistencia en Fabricacion"
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

                <Campo label="NSS (Número de Seguro Social)">
                  <input
                    value={formulario.nss}
                    onChange={(e) => setFormulario({ ...formulario, nss: e.target.value })}
                    placeholder="Ej. 0905-88-7715-1"
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>
                <Campo label="RFC">
                  <input
                    value={formulario.rfc}
                    onChange={(e) => setFormulario({ ...formulario, rfc: e.target.value.toUpperCase() })}
                    placeholder="Ej. CACE8809015K6"
                    className={CAMPO_GAFETE_CLASS}
                  />
                </Campo>

                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                  <strong className="text-foreground">Datos institucionales del taller (fijos)</strong>
                  <p className="mt-1">
                    {DATOS_TALLER_GAFETES.domicilioLinea1} · {DATOS_TALLER_GAFETES.domicilioLinea2} ·{" "}
                    {DATOS_TALLER_GAFETES.domicilioLinea3}
                  </p>
                  <p>
                    {DATOS_TALLER_GAFETES.responsableNombre} · {DATOS_TALLER_GAFETES.responsablePuesto} ·{" "}
                    {DATOS_TALLER_GAFETES.responsableTelefono}
                  </p>
                </div>

                <Campo label="Fotografía de credencial" wide>
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
                <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setVistaModal("frente")}
                    className={`rounded px-3 py-1 transition-colors ${
                      vistaModal === "frente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={() => setVistaModal("reverso")}
                    className={`rounded px-3 py-1 transition-colors ${
                      vistaModal === "reverso" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Reverso
                  </button>
                </div>

                <div className="origin-top scale-[.80] -mb-16">
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
                    reverso={vistaModal === "reverso"}
                  />
                </div>

                <p className="text-center text-[11px] text-muted-foreground">
                  Vista previa con fondo metálico institucional y datos en vivo.
                </p>
              </aside>
            </div>
            <DialogFooter className="border-t border-border p-4">
              <Button variant="outline" onClick={cerrarEdicion} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={guardando}>
                <Save />
                {guardando ? "Guardando…" : "Guardar perfil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="gafete-print-root">
        {modoImpresion === "enmicado" ? (
          hojasEnmicado.map((hoja, indice) => <HojaEnmicado key={`enmicado-${indice}`} hoja={hoja} />)
        ) : (
          hojasDuplex.flatMap((hoja, indice) => [
            <HojaDuplex key={`duplex-frentes-${indice}`} hoja={hoja} reverso={false} />,
            <HojaDuplex key={`duplex-reversos-${indice}`} hoja={hoja} reverso />,
          ])
        )}
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
