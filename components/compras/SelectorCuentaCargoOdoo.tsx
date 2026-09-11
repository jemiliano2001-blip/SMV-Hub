'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Loader2, Sparkles, Check, Building2, Hash } from 'lucide-react'
import { useVentasOdoo } from '@/lib/hooks/useVentasOdoo'
import {
  CUENTAS_CARGO_RAPIDAS,
  mapearPartnerAEmpresa,
  extraerPoClienteDeSo,
} from '@/lib/captura-rapida-compras'
import type { VentaOdooSo } from '@/lib/schemas'

export interface SelectorCuentaCargoOdooProps {
  value: string
  empresa?: string
  onChange: (value: string) => void
  onSelectSo?: (data: {
    cuentaCargo: string
    empresa?: string
    ordenCompra?: string
    ordenTrabajo?: string
  }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export default function SelectorCuentaCargoOdoo({
  value,
  empresa,
  onChange,
  onSelectSo,
  placeholder = 'SO1148 / Stock...',
  disabled = false,
  className = '',
  id,
}: SelectorCuentaCargoOdooProps) {
  const [abierto, setAbierto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)
  const inputBusquedaRef = useRef<HTMLInputElement>(null)

  const { sos, loading } = useVentasOdoo()

  // Cierra al hacer clic fuera del componente
  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickFuera)
      // Focus automático en la barra de búsqueda al abrir
      setTimeout(() => inputBusquedaRef.current?.focus(), 50)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFuera)
    }
  }, [abierto])

  // Separa y prioriza las órdenes según la empresa seleccionada
  const { sosDeEmpresa, otrasSos, totalFiltradas } = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    const filtradas = sos.filter((so) => {
      if (!q) return true
      const nombre = (so.name || '').toLowerCase()
      const partner = (so.partnerName || '').toLowerCase()
      const oc = (so.ordenCompra || '').toLowerCase()
      const ref = (so.clientOrderRef || '').toLowerCase()
      return (
        nombre.includes(q) ||
        partner.includes(q) ||
        oc.includes(q) ||
        ref.includes(q)
      )
    })

    const empLimpia = empresa?.trim().toUpperCase()
    if (!empLimpia || empLimpia === 'SMV') {
      return { sosDeEmpresa: [], otrasSos: filtradas, totalFiltradas: filtradas.length }
    }

    const deEmpresa: VentaOdooSo[] = []
    const otras: VentaOdooSo[] = []

    for (const so of filtradas) {
      const empSo = mapearPartnerAEmpresa(so.partnerName).toUpperCase()
      if (empSo === empLimpia) {
        deEmpresa.push(so)
      } else {
        otras.push(so)
      }
    }

    return { sosDeEmpresa: deEmpresa, otrasSos: otras, totalFiltradas: filtradas.length }
  }, [sos, filtro, empresa])

  function handleSeleccionarOdoo(so: VentaOdooSo) {
    const cuenta = so.name.trim()
    const empMapeada = mapearPartnerAEmpresa(so.partnerName)
    const ordenCompra = extraerPoClienteDeSo(so)

    onChange(cuenta)
    onSelectSo?.({
      cuentaCargo: cuenta,
      empresa: empMapeada,
      ordenCompra,
      ordenTrabajo: cuenta,
    })
    setAbierto(false)
    setFiltro('')
  }

  function handleSeleccionarRapida(cuenta: string) {
    const empMapeada = cuenta === 'Stock' ? 'SMV' : undefined
    onChange(cuenta)
    onSelectSo?.({ cuentaCargo: cuenta, empresa: empMapeada })
    setAbierto(false)
    setFiltro('')
  }

  const renderBotonSo = (so: VentaOdooSo, esDeEstaEmpresa = false) => {
    const seleccionada = value === so.name
    const poCliente = extraerPoClienteDeSo(so)
    return (
      <button
        key={so.id}
        type="button"
        onClick={() => handleSeleccionarOdoo(so)}
        className={`w-full text-left px-2.5 py-2 rounded transition-colors flex flex-col gap-0.5 ${
          seleccionada
            ? 'bg-primary/10 text-primary'
            : esDeEstaEmpresa
              ? 'hover:bg-primary/5 text-foreground bg-primary/2'
              : 'hover:bg-muted/80 text-foreground'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
            <Hash className="h-3 w-3 text-muted-foreground" />
            {so.name}
          </span>
          <div className="flex items-center gap-1">
            {esDeEstaEmpresa && (
              <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                {empresa}
              </span>
            )}
            {poCliente && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                PO: {poCliente}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
          <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{so.partnerName || 'Sin cliente asignado'}</span>
        </div>
      </button>
    )
  }

  return (
    <div ref={contenedorRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setAbierto((prev) => !prev)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="Ver órdenes de Odoo y cuentas frecuentes"
          aria-label="Ver órdenes de Odoo"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {abierto && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] max-w-sm rounded-lg border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95">
          {/* Buscador interno */}
          <div className="border-b border-border p-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputBusquedaRef}
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por SO, cliente o PO..."
                className="w-full rounded-md border border-input bg-muted/40 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Opciones rápidas */}
          <div className="border-b border-border/60 bg-muted/20 px-2 py-1.5">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cuentas frecuentes
            </span>
            <div className="flex flex-wrap gap-1">
              {CUENTAS_CARGO_RAPIDAS.map((cuenta) => {
                const activa = value === cuenta
                const esStockPropia = cuenta === 'Stock' && (!empresa || empresa === 'SMV')
                return (
                  <button
                    key={cuenta}
                    type="button"
                    onClick={() => handleSeleccionarRapida(cuenta)}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      activa
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : esStockPropia
                          ? 'border-amber-300 bg-amber-50/70 text-amber-900 font-medium'
                          : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {cuenta === 'Stock' && <Sparkles className="h-3 w-3 text-amber-500" />}
                    {cuenta === 'Stock' ? 'Stock (SMV)' : cuenta}
                    {activa && <Check className="h-3 w-3 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lista scrollable de órdenes Odoo */}
          <div className="max-h-60 overflow-y-auto divide-y divide-border/40 p-1">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Órdenes Odoo ({totalFiltradas})</span>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </div>

            {loading && sos.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Cargando órdenes de Odoo...
              </div>
            ) : totalFiltradas === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-muted-foreground">
                {sos.length === 0
                  ? 'No hay órdenes sincronizadas desde Odoo aún.'
                  : 'No se encontraron órdenes con ese filtro.'}
              </div>
            ) : (
              <>
                {sosDeEmpresa.length > 0 && (
                  <div className="space-y-0.5 mb-1.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded flex items-center justify-between">
                      <span>Órdenes de {empresa} ({sosDeEmpresa.length})</span>
                      <Sparkles className="h-3 w-3" />
                    </div>
                    {sosDeEmpresa.map((so) => renderBotonSo(so, true))}
                  </div>
                )}

                {otrasSos.length > 0 && (
                  <div className="space-y-0.5">
                    {sosDeEmpresa.length > 0 && (
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span>Otras órdenes Odoo ({otrasSos.length})</span>
                      </div>
                    )}
                    {otrasSos.map((so) => renderBotonSo(so, false))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
