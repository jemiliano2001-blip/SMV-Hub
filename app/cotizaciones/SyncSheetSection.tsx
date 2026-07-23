'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw,
  Link2,
  AlertCircle,
  Clock,
  FileSpreadsheet,
  Globe,
  HelpCircle,
} from 'lucide-react'
import {
  obtenerConfigCotizacionesSync,
  guardarConfigCotizacionesSync,
  sincronizarCotizacionesDesdeUrl,
  type ConfigCotizacionesSync,
} from '@/lib/cotizaciones-sync'
import { toast } from 'sonner'

interface SyncSheetSectionProps {
  onSyncCompletada?: () => void
}

export default function SyncSheetSection({ onSyncCompletada }: SyncSheetSectionProps) {
  const [config, setConfig] = useState<ConfigCotizacionesSync | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [guardandoUrl, setGuardandoUrl] = useState(false)
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)

  useEffect(() => {
    cargarConfig()
  }, [])

  async function cargarConfig() {
    setCargando(true)
    try {
      const cfg = await obtenerConfigCotizacionesSync()
      setConfig(cfg)
      setUrlInput(cfg.urlSheet)
    } catch (err) {
      console.error('[SyncSheetSection] Error al cargar config:', err)
    } finally {
      setCargando(false)
    }
  }

  async function handleGuardarUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!urlInput.trim()) {
      toast.error('Por favor ingresa un enlace válido de Google Sheets.')
      return
    }

    if (!urlInput.includes('pub') && !urlInput.includes('output=csv') && !urlInput.includes('spreadsheets')) {
      toast.warning('El enlace debe ser una URL publicada en la Web (formato CSV).')
    }

    setGuardandoUrl(true)
    try {
      await guardarConfigCotizacionesSync({
        urlSheet: urlInput.trim(),
        autoSyncActivo: true,
      })
      toast.success('Enlace de Google Sheet guardado correctamente.')
      await cargarConfig()
    } catch {
      toast.error('No se pudo guardar la configuración.')
    } finally {
      setGuardandoUrl(false)
    }
  }

  async function handleEjecutarSync() {
    const urlTarget = urlInput.trim() || config?.urlSheet
    if (!urlTarget) {
      toast.error('Primero debes configurar un enlace de Google Sheet.')
      return
    }

    setSincronizando(true)
    setProgreso(null)
    try {
      const res = await sincronizarCotizacionesDesdeUrl(urlTarget, (hechas, total) => {
        setProgreso({ hechas, total })
      })

      if (res.nuevas === 0) {
        toast.info(`La base de datos está al día. ${res.duplicadas} registros ya existían.`)
      } else {
        toast.success(`¡Sincronización exitosa! Se agregaron ${res.nuevas} nuevas cotizaciones.`)
      }

      await cargarConfig()
      onSyncCompletada?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar'
      toast.error(msg)
      await cargarConfig()
    } finally {
      setSincronizando(false)
      setProgreso(null)
    }
  }

  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-10 bg-slate-100 rounded w-full"></div>
      </div>
    )
  }

  const tieneUrl = Boolean(config?.urlSheet)
  const esExito = config?.estadoUltimaSinc === 'exito'
  const esError = config?.estadoUltimaSinc === 'error'

  return (
    <div className="space-y-4">
      {/* Target Sheet Status Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-lg shrink-0 ${
              esExito ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              esError ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              'bg-sky-50 text-sky-600 border border-sky-200'
            }`}>
              <FileSpreadsheet className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Sincronización Automática con Google Sheet
                </h3>

                {tieneUrl ? (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    esExito ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                    esError ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                    'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      esExito ? 'bg-emerald-500 animate-pulse' :
                      esError ? 'bg-rose-500' :
                      'bg-slate-400'
                    }`} />
                    {esExito ? 'Auto-Sync Activo' : esError ? 'Error en Última Sync' : 'Configurado'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    ⚪ Sin Enlace Configurado
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Conecta tu libro de cotizaciones publicado en la web para actualizar el catálogo de SMV Hub con 1 clic.
              </p>

              {config?.ultimaSincronizacion && (
                <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1 pt-0.5">
                  <Clock className="h-3 w-3" />
                  Última sincronización: {config.ultimaSincronizacion.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {config.nuevasUltimaSinc} nuevas · {config.duplicadasUltimaSinc} duplicadas
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
            <button
              type="button"
              onClick={() => setMostrarGuia(!mostrarGuia)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              ¿Cómo publicar?
            </button>

            <button
              type="button"
              onClick={handleEjecutarSync}
              disabled={sincronizando || !tieneUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? (progreso ? `Importando ${progreso.hechas}/${progreso.total}...` : 'Sincronizando...') : 'Sincronizar Ahora'}
            </button>
          </div>
        </div>

        {/* Guía desplegable */}
        {mostrarGuia && (
          <div className="mt-4 p-4 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-2 animate-in fade-in slide-in-from-top-2">
            <p className="font-bold flex items-center gap-1.5 text-sky-950">
              <Globe className="h-4 w-4 text-sky-600" />
              Pasos para publicar tu Google Sheet en la Web:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-700">
              <li>Abre tu archivo de cotizaciones en <strong>Google Sheets</strong>.</li>
              <li>Ve al menú <strong>Archivo ➔ Compartir ➔ Publicar en la Web</strong>.</li>
              <li>En la ventana emergente, selecciona la hoja deseada y cámbiala a formato <strong>Valores separados por comas (.csv)</strong>.</li>
              <li>Haz clic en <strong>Publicar</strong> y copia el enlace generado (ejemplo: <code className="bg-white px-1 py-0.5 rounded font-mono text-[11px] border border-sky-200">https://docs.google.com/spreadsheets/d/e/.../pub?output=csv</code>).</li>
              <li>Pega ese enlace en el campo de abajo y da clic en <strong>Guardar Enlace</strong>.</li>
            </ol>
          </div>
        )}

        {/* Config URL Form */}
        <form onSubmit={handleGuardarUrl} className="mt-4 flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={guardandoUrl || urlInput.trim() === config?.urlSheet}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shrink-0"
          >
            {guardandoUrl ? 'Guardando...' : 'Guardar Enlace'}
          </button>
        </form>

        {config?.errorMensaje && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="truncate">{config.errorMensaje}</span>
          </div>
        )}
      </div>
    </div>
  )
}
