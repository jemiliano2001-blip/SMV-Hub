'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, RefreshCw, X, Check, RotateCcw, AlertCircle } from 'lucide-react'

interface ModalCamaraProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
  titulo?: string
}

export function ModalCamara({
  isOpen,
  onClose,
  onCapture,
  titulo = 'Tomar Foto con Cámara',
}: ModalCamaraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCamera, setErrorCamera] = useState<string | null>(null)
  const [tieneMultiplesCamaras, setTieneMultiplesCamaras] = useState(false)

  // Efecto para abrir/cerrar la cámara
  useEffect(() => {
    if (!isOpen || capturedDataUrl) return

    let active = true
    let localStream: MediaStream | null = null

    const iniciar = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (active) setErrorCamera('Tu navegador no soporta el acceso a la cámara.')
          if (active) setCargando(false)
          return
        }

        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        if (active) setTieneMultiplesCamaras(videoDevices.length > 1)

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        localStream = mediaStream

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play().catch(() => {})
        }
      } catch (err: unknown) {
        console.error('Error al acceder a la cámara:', err)
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilita el acceso en tu navegador.'
            : 'No se pudo activar la cámara. Verifica que no esté en uso por otra app.'
        if (active) setErrorCamera(msg)
      } finally {
        if (active) setCargando(false)
      }
    }

    void iniciar()

    return () => {
      active = false
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOpen, capturedDataUrl, facingMode])

  // Reintentar acceso a cámara
  const reintentarCamara = () => {
    setCargando(true)
    setErrorCamera(null)
    setCapturedDataUrl(null)
  }

  // Cambiar entre cámara frontal y trasera
  const alternarCamara = () => {
    setCargando(true)
    setErrorCamera(null)
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Tomar la foto
  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Dibujar el fotograma actual
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    // Al fijar capturedDataUrl cambia una dep del useEffect: su cleanup detiene
    // el stream. No hace falta pararlo aquí.
    setCapturedDataUrl(dataUrl)
  }

  // Descartar captura y tomar otra foto
  const tomarOtra = () => {
    setCapturedDataUrl(null)
  }

  // Confirmar y usar la foto tomada
  const confirmarFoto = () => {
    if (!capturedDataUrl) return

    // Convertir dataURL a objeto File
    const arr = capturedDataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `foto-camara-${timestamp}.jpg`
    const file = new File([u8arr], filename, { type: mime })

    onCapture(file)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 p-3 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-gray-900 text-white shadow-2xl">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-sky-400" />
            <h3 className="text-base font-semibold">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Visor o Vista Previa */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black min-h-[300px] max-h-[60vh]">
          {errorCamera ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center text-rose-400">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm font-medium">{errorCamera}</p>
              <button
                type="button"
                onClick={reintentarCamara}
                className="mt-2 rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
              >
                Reintentar
              </button>
            </div>
          ) : capturedDataUrl ? (
            /* Foto capturada para confirmación */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedDataUrl}
              alt="Foto capturada"
              className="h-full w-full object-contain"
            />
          ) : (
            /* Streaming de cámara */
            <>
              {cargando && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  <RefreshCw className="h-8 w-8 animate-spin text-sky-400" />
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-contain"
              />
            </>
          )}

          {/* Canvas oculto para procesar foto */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Acciones y Controles */}
        <div className="border-t border-gray-800 bg-gray-900 p-4">
          {capturedDataUrl ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={tomarOtra}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                Tomar otra
              </button>
              <button
                type="button"
                onClick={confirmarFoto}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-sky-500"
              >
                <Check className="h-4 w-4" />
                Usar esta foto
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-around gap-4">
              {tieneMultiplesCamaras ? (
                <button
                  type="button"
                  onClick={alternarCamara}
                  disabled={cargando || Boolean(errorCamera)}
                  className="rounded-full bg-gray-800 p-3 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                  title="Girar cámara"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-11" />
              )}

              {/* Botón obturador */}
              <button
                type="button"
                onClick={capturarFoto}
                disabled={cargando || Boolean(errorCamera)}
                className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-sky-500 shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                title="Tomar foto"
              >
                <div className="h-12 w-12 rounded-full border-2 border-sky-400 bg-white" />
              </button>

              <div className="w-11" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
