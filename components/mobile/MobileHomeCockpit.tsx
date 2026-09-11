'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Bell,
  ShoppingCart,
  FileSearch,
  Building2,
  ClipboardCheck,
  Archive,
  Package,
  Timer,
  Wallet,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { tieneModulo } from '@/lib/roles'
import { usePedidosAlmacenPendientesCount } from '@/lib/hooks/usePedidosAlmacenPendientesCount'
import { useNotificaciones } from '@/lib/hooks/useNotificaciones'
import { cn } from '@/lib/utils'

interface QuickActionDef {
  href: string
  label: string
  desc: string
  icon: LucideIcon
  colorClass: string
}

type PerspectivaRol = 'compras' | 'almacen' | 'finanzas' | 'admin' | 'operacion'

export function MobileHomeCockpit() {
  const { usuario } = useUsuario()
  const bypass = authBypassActivo()
  const { modulos, esSuperAdmin, atiendeDocumentosVenta } = usePermisos(
    bypass ? null : usuario
  )

  const pedidosCount = usePedidosAlmacenPendientesCount()
  const { noLeidas: notificacionesCount } = useNotificaciones({
    enabled: Boolean(usuario || bypass),
    uid: bypass ? null : usuario?.uid,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta,
  })

  // Determina el rol base del usuario de forma automática
  const rolBase = useMemo<PerspectivaRol>(() => {
    if (esSuperAdmin || bypass) return 'admin'
    const list = modulos ?? []
    if (tieneModulo(list, 'compras-odoo') || tieneModulo(list, 'nueva-compra') || tieneModulo(list, 'ordenes')) {
      return 'compras'
    }
    if (tieneModulo(list, 'almacen') || tieneModulo(list, 'pedidos-almacen') || tieneModulo(list, 'endmills')) {
      return 'almacen'
    }
    if (tieneModulo(list, 'finanzas') || tieneModulo(list, 'caja-chica')) {
      return 'finanzas'
    }
    return 'operacion'
  }, [modulos, esSuperAdmin, bypass])

  // Selector de perspectiva para Super-Admin
  const [perspectiva, setPerspectiva] = useState<PerspectivaRol | null>(null)
  const rolActivo = perspectiva ?? rolBase

  // Nombre y badge del usuario con null-safety estricto
  const nombreCompleto = (usuario?.displayName || usuario?.email?.split('@')[0] || 'Equipo SMV').trim() || 'Equipo SMV'
  const primerNombre = nombreCompleto.split(' ')[0] || 'Equipo SMV'
  const inicial = (primerNombre[0] || 'S').toUpperCase()

  const etiquetaRol = useMemo(() => {
    switch (rolActivo) {
      case 'compras':
        return 'COMPRAS'
      case 'almacen':
        return 'ALMACÉN'
      case 'finanzas':
        return 'FINANZAS'
      case 'admin':
        return 'ADMIN'
      default:
        return 'OPERACIÓN'
    }
  }, [rolActivo])

  // KPIs por rol
  const kpis = useMemo(() => {
    switch (rolActivo) {
      case 'compras':
        return [
          {
            valor: pedidosCount > 0 ? String(pedidosCount) : '0',
            label: 'Pedidos por atender',
            tone: 'text-amber-600 dark:text-amber-400',
            href: '/pedidos-almacen',
          },
          {
            valor: 'IA',
            label: 'Extracción de facturas',
            tone: 'text-primary',
            href: '/nueva-compra',
          },
        ]
      case 'almacen':
        return [
          {
            valor: pedidosCount > 0 ? String(pedidosCount) : '0',
            label: 'Pedidos por surtir',
            tone: pedidosCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
            href: '/pedidos-almacen',
          },
          {
            valor: 'Stock',
            label: 'Entradas / Salidas',
            tone: 'text-primary',
            href: '/almacen',
          },
        ]
      case 'finanzas':
        return [
          {
            valor: 'Caja',
            label: 'Fondo y vales activos',
            tone: 'text-primary',
            href: '/caja-chica',
          },
          {
            valor: 'Odoo',
            label: 'Facturación y cobranza',
            tone: 'text-emerald-600 dark:text-emerald-400',
            href: '/finanzas',
          },
        ]
      default:
        return [
          {
            valor: pedidosCount > 0 ? String(pedidosCount) : '0',
            label: 'Pedidos activos',
            tone: 'text-primary',
            href: '/pedidos-almacen',
          },
          {
            valor: notificacionesCount > 0 ? String(notificacionesCount) : '0',
            label: 'Alertas sin leer',
            tone: notificacionesCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
            href: '/notificaciones',
          },
        ]
    }
  }, [rolActivo, pedidosCount, notificacionesCount])

  // Acciones rápidas (Cuadrícula 2x2)
  const accionesRapidas = useMemo<QuickActionDef[]>(() => {
    switch (rolActivo) {
      case 'compras':
        return [
          {
            href: '/nueva-compra',
            label: 'Nueva compra (IA)',
            desc: 'Escanear factura',
            icon: ShoppingCart,
            colorClass: 'bg-primary/10 text-primary',
          },
          {
            href: '/cotizaciones',
            label: 'Cotizaciones',
            desc: 'Comparar precios',
            icon: FileSearch,
            colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
          },
          {
            href: '/proveedores',
            label: 'Proveedores',
            desc: 'Directorio USA/MX',
            icon: Building2,
            colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          },
          {
            href: '/pedidos-almacen',
            label: 'Pedidos almacén',
            desc: 'Solicitudes piso',
            icon: ClipboardCheck,
            colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
          },
        ]
      case 'almacen':
        return [
          {
            href: '/pedidos-almacen',
            label: 'Pedidos almacén',
            desc: 'Surtir material',
            icon: ClipboardCheck,
            colorClass: 'bg-primary/10 text-primary',
          },
          {
            href: '/almacen',
            label: 'Stock materiales',
            desc: 'Entradas y salidas',
            icon: Archive,
            colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
          },
          {
            href: '/endmills',
            label: 'Endmills China',
            desc: 'Herramientas CNC',
            icon: Package,
            colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
          },
          {
            href: '/banos',
            label: 'Control de baños',
            desc: 'Registro táctil',
            icon: Timer,
            colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
          },
        ]
      case 'finanzas':
        return [
          {
            href: '/caja-chica',
            label: 'Caja chica',
            desc: 'Vales y comprobaciones',
            icon: Wallet,
            colorClass: 'bg-primary/10 text-primary',
          },
          {
            href: '/finanzas',
            label: 'Resumen finanzas',
            desc: 'KPIs de cobranza',
            icon: TrendingUp,
            colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          },
          {
            href: '/finanzas/facturacion',
            label: 'Facturación clientes',
            desc: 'Odoo clientes',
            icon: Receipt,
            colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
          },
          {
            href: '/reportes/contable',
            label: 'Reporte contable',
            desc: 'Cierre mensual SAT',
            icon: FileSpreadsheet,
            colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
          },
        ]
      default:
        return [
          {
            href: '/pedidos-almacen',
            label: 'Pedidos almacén',
            desc: 'Solicitar material',
            icon: ClipboardCheck,
            colorClass: 'bg-primary/10 text-primary',
          },
          {
            href: '/documentos-venta',
            label: 'Doc. de venta',
            desc: 'Remisiones y chat',
            icon: FileText,
            colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
          },
          {
            href: '/horas-extra',
            label: 'Horas extra',
            desc: 'Registro de turnos',
            icon: Clock,
            colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
          },
          {
            href: '/banos',
            label: 'Control de baños',
            desc: 'Registro táctil',
            icon: Timer,
            colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
          },
        ]
    }
  }, [rolActivo])

  // Tareas pendientes
  const tareasPendientes = useMemo(() => {
    const tareas = []
    if (pedidosCount > 0) {
      tareas.push({
        id: 'pedidos',
        titulo: `${pedidosCount} pedido${pedidosCount === 1 ? '' : 's'} de almacén pendiente${pedidosCount === 1 ? '' : 's'}`,
        sub: 'Esperando surtido o compra inmediata',
        color: 'bg-amber-500',
        href: '/pedidos-almacen',
      })
    }
    if (notificacionesCount > 0) {
      tareas.push({
        id: 'notif',
        titulo: `${notificacionesCount} alerta${notificacionesCount === 1 ? '' : 's'} sin revisar`,
        sub: 'Avisos recientes del taller y compras',
        color: 'bg-primary',
        href: '/notificaciones',
      })
    }
    return tareas
  }, [pedidosCount, notificacionesCount])

  const abrirMasDrawer = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smv:abrir-mas-drawer'))
    }
  }

  return (
    <div className="space-y-4 pb-20 pt-1">
      {/* ── 1. Cabecera del Usuario ───────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shadow-xs ring-2 ring-primary/20">
              {inicial}
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-snug">
                Hola, {primerNombre}
              </h1>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {etiquetaRol}
              </p>
            </div>
          </div>

          <Link
            href="/notificaciones"
            className="relative size-10 rounded-xl bg-muted/70 flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-transform"
            aria-label="Ver notificaciones"
          >
            <Bell className="size-5 text-primary" />
            {notificacionesCount > 0 && (
              <span className="absolute top-2 right-2 size-2.5 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </Link>
        </div>

        {/* Selector de Perspectiva (Super-Admin / Bypass) */}
        {(esSuperAdmin || bypass) && (
          <div className="mt-3 pt-3 border-t border-border/70">
            <div className="flex items-center justify-between gap-1 bg-muted/60 p-1 rounded-xl">
              {(['compras', 'almacen', 'finanzas', 'admin'] as const).map((r) => {
                const activo = rolActivo === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPerspectiva(r)}
                    className={cn(
                      'flex-1 py-1 px-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide transition-all touch-manipulation',
                      activo
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Estadísticas / KPIs de Impacto (2 Columnas) ── */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="block rounded-2xl border border-border bg-card p-3.5 shadow-2xs hover:border-primary/40 active:scale-[0.98] transition-all touch-manipulation"
          >
            <div className={cn('font-mono text-2xl font-bold tracking-tight', kpi.tone)}>
              {kpi.valor}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground mt-1 truncate">
              {kpi.label}
            </div>
          </Link>
        ))}
      </div>

      {/* ── 3. Accesos Rápidos Táctiles (Cuadrícula 2x2) ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Accesos Rápidos
          </span>
          <Sparkles className="size-3.5 text-primary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {accionesRapidas.map((acc) => {
            const Icon = acc.icon
            return (
              <Link
                key={acc.href}
                href={acc.href}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 shadow-2xs hover:border-primary/30 active:scale-[0.98] transition-all touch-manipulation group select-none"
              >
                <div
                  className={cn(
                    'size-9 rounded-xl flex items-center justify-center transition-colors group-hover:scale-105',
                    acc.colorClass
                  )}
                >
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-tight">
                    {acc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {acc.desc}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── 4. Pendientes de ti ───────────────────────────── */}
      <div className="space-y-2">
        <div className="px-1">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Pendientes de ti
          </span>
        </div>

        {tareasPendientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-center">
            <p className="text-xs font-semibold text-foreground">
              Todo al día en tu turno
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              No tienes pedidos urgentes ni notificaciones sin atender.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tareasPendientes.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs hover:border-primary/30 active:scale-[0.98] transition-all touch-manipulation"
              >
                <div className={cn('size-2 rounded-full mt-1.5 shrink-0', t.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">
                    {t.titulo}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {t.sub}
                  </p>
                </div>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. Botón a Catálogo Completo ─────────────────── */}
      <button
        type="button"
        onClick={abrirMasDrawer}
        className="w-full py-3 px-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/10 active:scale-[0.98] transition-all touch-manipulation select-none"
      >
        <span>Ver todos los módulos y herramientas</span>
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
