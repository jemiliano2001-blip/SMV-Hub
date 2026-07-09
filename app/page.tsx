import LogoSMV from "@/app/LogoSMV"
import Link from 'next/link'
import { ShoppingCart, Package, Upload, BarChart3, FileSearch, ClipboardList, Wrench, Users, Archive, Clock, Search } from 'lucide-react'

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
              'group flex items-start gap-4 rounded-xl border p-5 cursor-pointer transition-all duration-150',
              primary
                ? 'bg-[#0369A1] border-[#0369A1] text-white hover:bg-[#0284C7] hover:border-[#0284C7]'
                : 'bg-white border-[#E2E8F0] hover:border-[#0369A1] hover:shadow-sm',
            ].join(' ')}
          >
            <div
              className={[
                'shrink-0 rounded-lg p-2 transition-colors duration-150',
                primary
                  ? 'bg-white/20'
                  : 'bg-[#F8FAFC] group-hover:bg-[#EFF6FF]',
              ].join(' ')}
            >
              <Icon className={`h-5 w-5 ${primary ? 'text-white' : 'text-[#0369A1]'}`} />
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm ${primary ? 'text-white' : 'text-[#0F172A]'}`}>
                {label}
              </div>
              <div className={`text-xs mt-0.5 leading-relaxed ${primary ? 'text-white/80' : 'text-[#64748B]'}`}>
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
