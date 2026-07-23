import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  procesarCSVCotizaciones,
  verificarDuplicadosCotizacion,
  importarCotizaciones,
} from "@/lib/cotizaciones-importar"
import { clavesExistentes } from "@/lib/cotizaciones"

export interface ConfigCotizacionesSync {
  urlSheet: string
  autoSyncActivo: boolean
  ultimaSincronizacion: Date | null
  totalCotizaciones: number
  nuevasUltimaSinc: number
  duplicadasUltimaSinc: number
  estadoUltimaSinc: 'exito' | 'error' | 'nunca'
  errorMensaje?: string | null
}

const DOC_ID = "cotizaciones_sync"
const colRef = () => doc(db, "configuraciones", DOC_ID)

export async function obtenerConfigCotizacionesSync(): Promise<ConfigCotizacionesSync> {
  try {
    const snap = await getDoc(colRef())
    if (snap.exists()) {
      const data = snap.data()
      return {
        urlSheet: data.urlSheet || "",
        autoSyncActivo: data.autoSyncActivo ?? false,
        ultimaSincronizacion: typeof data.ultimaSincronizacion?.toDate === "function"
          ? data.ultimaSincronizacion.toDate()
          : data.ultimaSincronizacion ? new Date(data.ultimaSincronizacion) : null,
        totalCotizaciones: data.totalCotizaciones || 0,
        nuevasUltimaSinc: data.nuevasUltimaSinc || 0,
        duplicadasUltimaSinc: data.duplicadasUltimaSinc || 0,
        estadoUltimaSinc: data.estadoUltimaSinc || "nunca",
        errorMensaje: data.errorMensaje || null,
      }
    }
  } catch (err) {
    console.warn("[cotizaciones-sync] Error leyendo configuración de Firestore:", err)
  }

  return {
    urlSheet: "",
    autoSyncActivo: false,
    ultimaSincronizacion: null,
    totalCotizaciones: 0,
    nuevasUltimaSinc: 0,
    duplicadasUltimaSinc: 0,
    estadoUltimaSinc: "nunca",
  }
}

export async function guardarConfigCotizacionesSync(
  params: Partial<ConfigCotizacionesSync>
): Promise<void> {
  const actual = await obtenerConfigCotizacionesSync()
  const nuevaConfig = { ...actual, ...params }

  const payload: Record<string, unknown> = {
    urlSheet: nuevaConfig.urlSheet,
    autoSyncActivo: nuevaConfig.autoSyncActivo,
    ultimaSincronizacion: nuevaConfig.ultimaSincronizacion
      ? Timestamp.fromDate(nuevaConfig.ultimaSincronizacion)
      : null,
    totalCotizaciones: nuevaConfig.totalCotizaciones,
    nuevasUltimaSinc: nuevaConfig.nuevasUltimaSinc,
    duplicadasUltimaSinc: nuevaConfig.duplicadasUltimaSinc,
    estadoUltimaSinc: nuevaConfig.estadoUltimaSinc,
    errorMensaje: nuevaConfig.errorMensaje || null,
    actualizadoEn: Timestamp.now(),
  }

  await setDoc(colRef(), payload, { merge: true })
}

export async function sincronizarCotizacionesDesdeUrl(
  urlSheetParam?: string,
  onProgreso?: (hechas: number, total: number) => void
): Promise<{ nuevas: number; duplicadas: number }> {
  const config = await obtenerConfigCotizacionesSync()
  const urlTarget = urlSheetParam || config.urlSheet

  if (!urlTarget.trim()) {
    throw new Error("No hay un enlace de Google Sheet configurado.")
  }

  try {
    const response = await fetch(urlTarget, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`No se pudo obtener el archivo desde el enlace. Código HTTP ${response.status}`)
    }

    const csvText = await response.text()
    if (!csvText.trim()) {
      throw new Error("El archivo publicado en la Web está vacío.")
    }

    const resultado = procesarCSVCotizaciones(csvText)
    if (resultado.error && resultado.filas.length === 0) {
      throw new Error(`Error en el formato del CSV: ${resultado.error}`)
    }

    const existentes = await clavesExistentes()
    const duplicados = verificarDuplicadosCotizacion(resultado.filas, existentes)
    const setDuplicados = new Set(duplicados.map((d) => d.indice))
    const validasSinDuplicados = resultado.filas.filter((_, i) => !setDuplicados.has(i))

    let creadas = 0
    if (validasSinDuplicados.length > 0) {
      const resImp = await importarCotizaciones(validasSinDuplicados, onProgreso)
      creadas = resImp.importadas
    }

    const totalCotizacionesNuevas = (config.totalCotizaciones || 0) + creadas
    await guardarConfigCotizacionesSync({
      urlSheet: urlTarget,
      autoSyncActivo: true,
      ultimaSincronizacion: new Date(),
      totalCotizaciones: totalCotizacionesNuevas,
      nuevasUltimaSinc: creadas,
      duplicadasUltimaSinc: setDuplicados.size,
      estadoUltimaSinc: "exito",
      errorMensaje: null,
    })

    return { nuevas: creadas, duplicadas: setDuplicados.size }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido al sincronizar"
    await guardarConfigCotizacionesSync({
      urlSheet: urlTarget,
      estadoUltimaSinc: "error",
      errorMensaje: msg,
    })
    throw err
  }
}
