'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

export default function BuscadorGlobalCommand() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Listener para Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <>
      {/* Botón Gatillo en Navbar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="hidden sm:inline">Buscar en SMV-Hub...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-300 bg-white px-1.5 font-mono text-[10px] font-bold text-slate-500 shadow-2xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Modal Dialog de Búsqueda Global */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Escribe para buscar proveedores, requisiciones, órdenes o secciones..." />
        <CommandList className="max-h-[380px] font-sans">
          <CommandEmpty>No se encontraron resultados para tu búsqueda.</CommandEmpty>

          {/* Secciones de Compras */}
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
              <span>Reabastecimiento ROP de Tooling e Inventarios</span>
              <CommandShortcut>ALM</CommandShortcut>
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

          {/* Secciones de Finanzas */}
          <CommandGroup heading="Finanzas & Facturación">
            <CommandItem onSelect={() => runCommand(() => router.push('/finanzas'))}>
              <DollarSign className="mr-2 h-4 w-4 text-emerald-600" />
              <span>Resumen Financiero &amp; Flujo de Efectivo</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/finanzas/facturacion'))}>
              <FileText className="mr-2 h-4 w-4 text-slate-600" />
              <span>Facturación Clientes (Odoo Sync)</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/caja-chica'))}>
              <DollarSign className="mr-2 h-4 w-4 text-amber-600" />
              <span>Caja Chica &amp; Gastos Menores</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Proveedores Frecuentes EE.UU. */}
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
        </CommandList>
      </CommandDialog>
    </>
  )
}
