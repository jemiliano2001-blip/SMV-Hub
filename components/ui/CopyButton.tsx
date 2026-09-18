'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string
  label?: string
  successMessage?: string
  iconOnly?: boolean
}

/**
 * Micro-componente reutilizable de copiado al portapapeles con confirmación visual de 2 segundos.
 */
export function CopyButton({
  text,
  label,
  successMessage,
  iconOnly = true,
  className,
  ...props
}: CopyButtonProps) {
  const [copiado, setCopiado] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      if (successMessage) {
        toast.success(successMessage)
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }, [text, successMessage])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copiado ? 'Copiado al portapapeles' : (label || 'Copiar al portapapeles')}
      title={copiado ? '¡Copiado!' : (label || 'Copiar')}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md p-1 text-xs font-medium',
        'text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground',
        'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        copiado && 'text-emerald-600 hover:text-emerald-600',
        className
      )}
      {...props}
    >
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5 animate-in zoom-in-50 duration-150" aria-hidden="true" />
          {!iconOnly && <span>¡Copiado!</span>}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {!iconOnly && <span>{label || 'Copiar'}</span>}
        </>
      )}
    </button>
  )
}
