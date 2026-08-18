'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  ShoppingCart,
  Building2,
  FileText,
  DollarSign,
  Package,
  Sparkles,
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  CommandDialog,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { getClienteAuth } from '@/lib/firebase'
import { formatPrecio } from '@/lib/format'
import type { ResultadoBusquedaSemantica } from '@/lib/busqueda-semantica-catalogo'

interface ResultadoSemanticoUI {
  item: ResultadoBusquedaSemantica
  score: number
  porcentajeSimilitud: number
}

export default function BuscadorGlobalCommand() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [resultadosSemanticos, setResultadosSemanticos] = useState<ResultadoSemanticoUI[]>([])
  const [buscandoSemantico, setBuscandoSemantico] = useState(false)
  const [errorSemantico, setErrorSemantico] = useState<string | null>(null)
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [retryToken, setRetryToken] = useState(0)

  const ejecutarBusquedaSemantica = useCallback(async (texto: string, signal: AbortSignal) => {
    const auth = getClienteAuth()
    const token = (await auth.currentUser?.getIdToken()) || ''
    const res = await fetch('/api/busqueda-semantica', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query: texto,
        topK: 4,
        minScore: 0.35,
      }),
      signal,
      cache: 'no-store',
    })

    if (res.ok) {
      const data = await res.json()
      setResultadosSemanticos(data?.resultado?.resultados || [])
      setErrorSemantico(null)
      return
    }

    const data = await res.json().catch(() => null)
    setResultadosSemanticos([])
    setErrorSemantico(data?.error || 'La búsqueda inteligente falló. Intenta de nuevo.')
  }, [])

  // Listener para Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    setQuery('')
    setResultadosSemanticos([])
    setErrorSemantico(null)
    setBuscandoSemantico(false)
    abortControllerRef.current?.abort()
    return undefined
  }, [open])

  // Debounce de búsqueda semántica — fuera de cmdk para que el fetch siempre dispare.
  useEffect(() => {
    if (!open) return undefined

    const q = query.trim()
    if (q.length < 3) {
      abortControllerRef.current?.abort()
      setResultadosSemanticos([])
      setErrorSemantico(null)
      setBuscandoSemantico(false)
      return undefined
    }

    setBuscandoSemantico(true)
    const debounce = setTimeout(() => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      void ejecutarBusquedaSemantica(q, controller.signal)
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setResultadosSemanticos([])
          setErrorSemantico('La búsqueda inteligente falló. Intenta de nuevo.')
        })
        .finally(() => {
          if (abortControllerRef.current === controller) {
            setBuscandoSemantico(false)
          }
        })
    }, 350)

    return () => {
      clearTimeout(debounce)
    }
  }, [open, query, retryToken, ejecutarBusquedaSemantica])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  const consultaLarga = query.trim().length >= 3

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="hidden sm:inline">Buscar en SMV-Hub...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 font-mono text-[10px] font-bold text-slate-500 shadow-2xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <div className="relative border-b px-3">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe para buscar proveedores, herramientas, refacciones o módulos..."
            className="h-12 w-full bg-transparent pl-9 pr-28 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Búsqueda global"
            autoComplete="off"
            spellCheck={false}
          />
          {buscandoSemantico && (
            <div className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-sky-600 animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Búsqueda semántica...</span>
            </div>
          )}
        </div>

        <CommandList className="max-h-[420px] font-sans">
          {!consultaLarga && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Escribe al menos 3 caracteres para buscar con IA.
            </p>
          )}

          {consultaLarga && !buscandoSemantico && !errorSemantico && resultadosSemanticos.length === 0 && (
            <div className="mx-2 mt-2 px-3 py-2 text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
              La búsqueda inteligente no encontró coincidencias para &quot;{query.trim()}&quot;.
            </div>
          )}

          {errorSemantico && (
            <div className="flex items-center justify-between gap-2 mx-2 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorSemantico}</span>
              </div>
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="font-semibold underline shrink-0 hover:text-red-900"
              >
                Reintentar
              </button>
            </div>
          )}

          {resultadosSemanticos.length > 0 && (
            <>
              <CommandGroup
                heading={
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Resultados Inteligentes IA (Órdenes &amp; Proveedores)</span>
                  </div>
                }
              >
                {resultadosSemanticos.map((res) => {
                  const { metadata } = res.item
                  return (
                    <CommandItem
                      key={res.item.id}
                      value={res.item.id}
                      onSelect={() => runCommand(() => router.push(res.item.refPath || '/proveedores'))}
                      className="flex flex-col items-start gap-1 py-2"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {res.item.fuente === 'proveedor' ? (
                            <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Package className="h-4 w-4 text-sky-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-1">
                            {res.item.titulo}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0 ml-2"
                        >
                          {res.porcentajeSimilitud}% afinidad
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-500 pl-6 flex items-center gap-1.5 flex-wrap">
                        {metadata.proveedorNombre && <span>{metadata.proveedorNombre}</span>}
                        {metadata.precio != null && (
                          <span className="font-mono">{formatPrecio(metadata.precio, metadata.moneda)}</span>
                        )}
                        {metadata.fecha && <span>{metadata.fecha}</span>}
                        {metadata.categorias?.map((cat) => (
                          <span key={cat} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {!consultaLarga && (
            <>
              <CommandGroup heading="Módulos de Compras & Tooling">
                <CommandItem onSelect={() => runCommand(() => router.push('/requisiciones'))}>
                  <ShoppingCart className="mr-2 h-4 w-4 text-[#0369A1]" />
                  <span>Flujo de Requisiciones &amp; Cotizaciones</span>
                  <CommandShortcut>REQ</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/proveedores'))}>
                  <Building2 className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>Catálogo &amp; Comparador de Proveedores (USA / MX)</span>
                  <CommandShortcut>PROV</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/almacen'))}>
                  <Package className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Almacén de materiales: entradas y salidas</span>
                  <CommandShortcut>ALM</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/endmills'))}>
                  <Sparkles className="mr-2 h-4 w-4 text-violet-600" />
                  <span>Endmills China: inventario y pedido sugerido</span>
                  <CommandShortcut>END</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/ordenes'))}>
                  <FileText className="mr-2 h-4 w-4 text-sky-600" />
                  <span>Historial de Órdenes de Compra (OC)</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/reportes'))}>
                  <TrendingUp className="mr-2 h-4 w-4 text-purple-600" />
                  <span>Dashboard de Inteligencia Operativa (3-Tier)</span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Finanzas & Facturación">
                <CommandItem onSelect={() => runCommand(() => router.push('/finanzas'))}>
                  <DollarSign className="mr-2 h-4 w-4 text-emerald-600" />
                  <span>Resumen Financiero &amp; Flujo de Efectivo</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/finanzas/facturacion'))}>
                  <FileText className="mr-2 h-4 w-4 text-slate-600" />
                  <span>Facturación Clientes (Odoo Sync)</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/documentos-venta'))}>
                  <FileText className="mr-2 h-4 w-4 text-sky-600" />
                  <span>Documentos de venta (remisión / factura)</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/caja-chica'))}>
                  <DollarSign className="mr-2 h-4 w-4 text-amber-600" />
                  <span>Caja Chica &amp; Gastos Menores</span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Proveedores Frecuentes EE.UU. / CNC">
                <CommandItem onSelect={() => runCommand(() => router.push('/proveedores'))}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Shars Tool Company (Endmills &amp; Cortadores)</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/proveedores'))}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Kennametal Authorized (Insertos Torneado/Fresado)</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => router.push('/proveedores'))}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  <span>Travers Tool Co (Consumibles &amp; Lubricantes)</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
