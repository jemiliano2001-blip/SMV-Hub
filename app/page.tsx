import LogoSMV from "@/app/LogoSMV"
import Link from 'next/link'
import { ShoppingCart, Package, Upload, BarChart3, FileSearch, ClipboardList, Wrench, Users, Archive, Clock, Search, ClipboardCheck } from 'lucide-react'
import PedidoAlmacenBadge from '@/app/pedidos-almacen/PedidoAlmacenBadge'

const NAV_CARDS = [
  {
    href: '/nueva-compra',
    icon: ShoppingCart,
    label: 'Nueva compra',
    desc: 'Registra una factura con extracción por IA',
    primary: true,
  },
  {
    href: '/ordenes',
    icon: Package,
    label: 'Ver órdenes',
    desc: 'Listado y gestión de compras registradas',
    primary: false,
  },
  {
    href: '/importar',
    icon: Upload,
    label: 'Importar masivo',
    desc: 'Carga un CSV con múltiples compras a la vez',
    primary: false,
  },
  {
    href: '/claves-sat',
    icon: Search,
    label: 'Claves SAT',
    desc: 'Buscador local para asignar códigos SAT sin depender del portal',
    primary: false,
  },
  {
    href: '/reportes',
    icon: BarChart3,
    label: 'Reportes',
    desc: 'KPIs, subtotales agrupados y exportación a PDF',
    primary: false,
  },
  {
    href: '/cotizaciones',
    icon: FileSearch,
    label: 'Cotizaciones',
    desc: 'Base de datos buscable de cotizaciones (MX/EUA)',
    primary: false,
  },
  {
    href: '/requisiciones',
    icon: ClipboardList,
    label: 'Requisiciones',
    desc: 'Compras generales y automatización — histórico buscable',
    primary: false,
  },
  {
    href: '/ordenes-servicio',
    icon: Wrench,
    label: 'Órdenes de servicio',
    desc: 'Seguimiento de OTs con proveedores externos (Fisher)',
    primary: false,
  },
  {
    href: '/operadores',
    icon: Users,
    label: 'Operadores',
    desc: 'Catálogo de personal — fuente para autocompletar nombres',
    primary: false,
  },
  {
    href: '/almacen',
    icon: Archive,
    label: 'Almacén',
    desc: 'Entrada y salida de materiales, cargo a órdenes y stock',
    primary: false,
  },
  {
    href: '/pedidos-almacen',
    icon: ClipboardCheck,
    label: 'Pedidos de almacén',
    desc: 'Lo que almacén pide comprar — captura rápida desde el celular',
    primary: false,
  },
  {
    href: '/banos',
    icon: Clock,
    label: 'Control de Baños',
    desc: 'Registro de tiempos y resumen mensual por operador',
    primary: false,
  },
  {
    href: '/horas-extra',
    icon: Wrench,
    label: 'Horas Extra',
    desc: 'Registro semanal de horas extra por departamento',
    primary: false,
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-16">
      {/* Brand */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2.5 mb-3">
          <LogoSMV height={36} />
          <span className="text-gray-300 text-2xl font-light">|</span>
          <span className="text-xl font-semibold text-[#0F172A] tracking-tight">SMV Hub</span>
        </div>
        <p className="text-[#64748B] text-sm max-w-sm mx-auto leading-relaxed">
          Compras, diseño y operación del taller en un solo lugar
        </p>
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-6xl">
        {NAV_CARDS.map(({ href, icon: Icon, label, desc, primary }) => (
          <Link
            key={href}
            href={href}
            className={[
              'group flex items-start gap-4 rounded-2xl border p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]',
              primary
                ? 'bg-gradient-to-br from-[#0369A1] to-[#1E40AF] border-transparent text-white hover:shadow-xl hover:shadow-blue-900/20 shadow-md'
                : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-xl hover:shadow-gray-200/50 shadow-sm',
            ].join(' ')}
          >
            <div
              className={[
                'shrink-0 rounded-xl p-2.5 transition-all duration-300 group-hover:scale-110 shadow-sm',
                primary
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-50 text-[#0369A1] group-hover:bg-blue-50 group-hover:text-blue-600',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 mt-0.5">
              <div className={`flex items-center gap-1.5 font-bold text-sm tracking-tight transition-colors ${primary ? 'text-white' : 'text-slate-900 group-hover:text-blue-900'}`}>
                {label}
                {href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
              </div>
              <div className={`text-xs mt-1.5 leading-relaxed font-medium ${primary ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-600'}`}>
                {desc}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-[#94A3B8]">SMV Maquinados · Monterrey, México</p>
    </main>
  )
}
