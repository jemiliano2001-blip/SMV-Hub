import React from 'react'

/**
 * Enlace accesible para navegación por teclado y lectores de pantalla (WCAG 2.4.1).
 * Oculto visualmente por defecto (`sr-only`) y visible inmediatamente al recibir foco.
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all font-medium text-sm"
    >
      Saltar al contenido principal
    </a>
  )
}
