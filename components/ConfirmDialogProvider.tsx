"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  normalizarConfirmacion,
  type ConfirmacionNormalizada,
  type OpcionesConfirmacion,
} from "@/lib/confirmacion"

type Resolver = (confirmado: boolean) => void

type SolicitudActiva = {
  opciones: ConfirmacionNormalizada
  resolver: Resolver
}

const ConfirmDialogContext = createContext<
  ((opciones: OpcionesConfirmacion) => Promise<boolean>) | null
>(null)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [solicitud, setSolicitud] = useState<SolicitudActiva | null>(null)
  const solicitudRef = useRef<SolicitudActiva | null>(null)

  const responder = useCallback((confirmado: boolean) => {
    const actual = solicitudRef.current
    if (!actual) return
    solicitudRef.current = null
    setSolicitud(null)
    actual.resolver(confirmado)
  }, [])

  const confirmar = useCallback(
    (opciones: OpcionesConfirmacion) =>
      new Promise<boolean>((resolver) => {
        if (solicitudRef.current) {
          solicitudRef.current.resolver(false)
        }
        const siguiente = {
          opciones: normalizarConfirmacion(opciones),
          resolver,
        }
        solicitudRef.current = siguiente
        setSolicitud(siguiente)
      }),
    []
  )

  const value = useMemo(() => confirmar, [confirmar])

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <AlertDialog
        open={Boolean(solicitud)}
        onOpenChange={(open) => {
          if (!open) responder(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{solicitud?.opciones.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {solicitud?.opciones.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => responder(false)}>
              {solicitud?.opciones.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => responder(true)}
              className={
                solicitud?.opciones.variant === "destructive"
                  ? "bg-rose-700 text-white hover:bg-rose-800 focus-visible:ring-rose-600"
                  : "bg-primary text-white hover:bg-primary/90"
              }
            >
              {solicitud?.opciones.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const confirmar = useContext(ConfirmDialogContext)
  if (!confirmar) {
    throw new Error("useConfirmDialog debe usarse dentro de ConfirmDialogProvider")
  }
  return confirmar
}

