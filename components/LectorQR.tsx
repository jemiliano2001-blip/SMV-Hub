'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, AlertCircle, QrCode } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface LectorQRProps {
  isOpen: boolean
  onClose: () => void
  onScan: (valorEscaneado: string) => void
  titulo?: string
  subtitulo?: string
}

/** Reproduce un bip suave de éxito usando Web Audio API sin dependencias de archivos */
function reproducirSonidoExito() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12) // E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Ignorar si el audio context está bloqueado
  }
}

export function LectorQR({
  isOpen,
  onClose,
  onScan,
  titulo = 'Escanear Gafete QR',
  subtitulo = 'Apunta la cámara al código QR del gafete',
}: LectorQRProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const animFrameRef = useRef<number | null>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cargando, setCargando] = useState(true)
  const [errorCamera, setErrorCamera] = useState<string | null>(null)
  const [tieneMultiplesCamaras, setTieneMultiplesCamaras] = useState(false)
  const [soportaBarcodeDetector] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  const [valorManual, setValorManual] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let active = true
    let localStream: MediaStream | null = null
    const tieneDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

    const iniciarCamara = async () => {
      setCargando(true)
      setErrorCamera(null)

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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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

        if (active) setCargando(false)

        // Iniciar loop de detección si hay BarcodeDetector
        if (tieneDetector) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'data_matrix'],
          })

          const escanearLoop = async () => {
            if (!active || !videoRef.current) return

            if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current) as Array<{ rawValue?: string; displayValue?: string }>
                if (barcodes && barcodes.length > 0 && active) {
                  const resultado = barcodes[0].rawValue || barcodes[0].displayValue
                  if (resultado) {
                    reproducirSonidoExito()
                    if (navigator.vibrate) navigator.vibrate(80)
                    onScan(resultado)
                    onClose()
                    return
                  }
                }
              } catch {
                // Continuar en el siguiente frame
              }
            }

            if (active) {
              animFrameRef.current = requestAnimationFrame(escanearLoop)
            }
          }

          animFrameRef.current = requestAnimationFrame(escanearLoop)
        }
      } catch (err: unknown) {
        console.error('Error al iniciar escáner de cámara:', err)
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilita el acceso en tu navegador.'
            : 'No se pudo activar la cámara. Verifica que no esté en uso.'
        if (active) setErrorCamera(msg)
        if (active) setCargando(false)
      }
    }

    void iniciarCamara()

    return () => {
      active = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOpen, facingMode, onScan, onClose])

  const alternarCamara = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }

  function handleEnvioManual(e: React.FormEvent) {
    e.preventDefault()
    const valor = valorManual.trim()
    if (!valor) return
    reproducirSonidoExito()
    onScan(valor)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden p-0 border border-border bg-card">
        <DialogHeader className="border-b border-border p-4 bg-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <QrCode className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-foreground">{titulo}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">{subtitulo}</DialogDescription>
              </div>
            </div>
            {tieneMultiplesCamaras && (
              <Button
                variant="ghost"
                size="sm"
                onClick={alternarCamara}
                className="h-8 px-2 text-xs font-semibold text-foreground hover:bg-muted"
                title="Cambiar cámara"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Girar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="relative aspect-square w-full max-h-[360px] bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />

          {cargando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs text-foreground p-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-xs font-semibold">Activando cámara…</p>
            </div>
          )}

          {errorCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-xs font-semibold text-foreground mb-1">Error de cámara</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs">{errorCamera}</p>
            </div>
          )}

          {/* Retícula visual de escaneo */}
          {!cargando && !errorCamera && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative size-48 sm:size-56 rounded-2xl border-2 border-primary/70 shadow-2xl">
                {/* Esquinas destacadas */}
                <div className="absolute -top-1 -left-1 size-5 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 size-5 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 size-5 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 size-5 border-b-4 border-r-4 border-primary rounded-br-lg" />

                {/* Línea de escaneo láser */}
                <div className="absolute left-0 right-0 h-0.5 bg-primary/90 shadow-[0_0_8px_rgba(3,105,161,0.8)] animate-pulse" style={{ top: '50%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Fallback de entrada manual o sin BarcodeDetector */}
        <div className="p-4 border-t border-border bg-card space-y-3">
          <form onSubmit={handleEnvioManual} className="flex gap-2">
            <input
              type="text"
              placeholder="O ingresa el ID / Nombre del operador…"
              value={valorManual}
              onChange={(e) => setValorManual(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Button type="submit" size="sm" className="h-8 px-3 text-xs font-bold">
              Aceptar
            </Button>
          </form>

          {!soportaBarcodeDetector && (
            <p className="text-[11px] text-muted-foreground text-center">
              💡 Tu navegador no tiene detector QR automático nativo; escribe el nombre o ID en el campo superior.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
