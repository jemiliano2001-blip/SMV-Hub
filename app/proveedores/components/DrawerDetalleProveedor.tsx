'use client'

import {
  Building2,
  X,
  Edit2,
  Trash2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Award,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Proveedor } from '@/lib/schemas'

interface DrawerDetalleProveedorProps {
  proveedor: Proveedor | null
  open: boolean
  onClose: () => void
  onEdit: (proveedor: Proveedor) => void
  onDelete: (id: string) => void
  scorecard?: {
    promedioGeneral: number
    leadTimePromedio: number
    leadTimeReal: number
    ordenesAprobadas: number
    totalOrdenes: number
  }
}

export default function DrawerDetalleProveedor({
  proveedor,
  open,
  onClose,
  onEdit,
  onDelete,
  scorecard,
}: DrawerDetalleProveedorProps) {
  if (!open || !proveedor) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md md:max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
          {/* Header del Drawer */}
          <div className="p-6 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`uppercase text-[10px] font-bold ${
                      proveedor.tipoProveedor === 'premium'
                        ? 'border-purple-300 text-purple-800 bg-purple-50'
                        : proveedor.tipoProveedor === 'barato'
                        ? 'border-amber-300 text-amber-800 bg-amber-50'
                        : 'border-sky-300 text-[#0369A1] bg-sky-50'
                    }`}
                  >
                    {proveedor.tipoProveedor === 'premium'
                      ? '⭐ Premium Performance'
                      : proveedor.tipoProveedor === 'barato'
                      ? '⚡ Económico ($ Barato)'
                      : '📦 Estándar ($)'}
                  </Badge>
                  <span className="text-xs text-slate-500 font-medium">
                    {proveedor.pais === 'Estados Unidos' ? '🇺🇸 USA' : '🇲🇽 México'}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  {proveedor.nombre}
                </h2>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Rating & Status Bar */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-amber-500">⭐ {proveedor.calificacion || 5}.0</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 font-medium">
                  Lead Time: {proveedor.leadTimeDias || '3-5'} días
                </span>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {proveedor.estatus === 'actual' ? 'Proveedor Activo' : proveedor.estatus}
              </Badge>
            </div>
          </div>

          {/* Cuerpo / Secciones */}
          <div className="p-6 space-y-6 flex-1 text-slate-800">
            {/* Scorecard 360° Metrics Box Light */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold tracking-wider text-indigo-300 uppercase">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-400" /> Scorecard 360° SMV Hub
                </span>
                <span>{scorecard ? `⭐ ${scorecard.promedioGeneral.toFixed(1)} / 5.0` : 'Sin datos'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                  <div className="text-slate-400 text-[10px]">Lead Time Prometido</div>
                  <div className="font-bold text-white text-sm">{scorecard?.leadTimePromedio ?? 'Sin datos'}{scorecard ? ' días' : ''}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                  <div className="text-slate-400 text-[10px]">Lead Time Real (Odoo)</div>
                  <div className="font-bold text-emerald-400 text-sm">{scorecard?.leadTimeReal ?? 'Sin datos'}{scorecard ? ' días' : ''}</div>
                </div>
              </div>
            </div>

            {/* Contactos & Datos de Comunicación */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contacto Directo & Web
              </h3>

              <div className="space-y-2 text-sm">
                {proveedor.web && (
                  <a
                    href={proveedor.web.startsWith('http') ? proveedor.web : `https://${proveedor.web}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50/60 hover:bg-sky-100/80 text-[#0369A1] transition-all font-semibold text-xs group border border-sky-200/60"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#0369A1]" /> {proveedor.web}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                )}

                {proveedor.email && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 text-xs">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{proveedor.email}</span>
                  </div>
                )}

                {proveedor.telefono && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 text-xs">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{proveedor.telefono}</span>
                  </div>
                )}

                {proveedor.contacto && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 text-xs">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Atención: <strong>{proveedor.contacto}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Categorías & Marcas Representadas */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Marcas Representadas & Especialidad
              </h3>

              <div className="flex flex-wrap gap-1.5">
                {proveedor.marcas && proveedor.marcas.length > 0 ? (
                  proveedor.marcas.map((m, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1"
                    >
                      {m}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No se han registrado marcas específicas</span>
                )}
              </div>
            </div>

            {/* Dirección EE. UU. / Logística */}
            {proveedor.shippingAddressUSA && (
              <div className="space-y-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" /> Shipping / Warehouse Address (USA)
                </div>
                <p className="text-xs text-amber-800 font-mono">
                  {proveedor.shippingAddressUSA}
                </p>
              </div>
            )}

            {/* Notas / Experiencia de Compra */}
            {proveedor.notas && (
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                <span className="font-bold text-slate-700">Notas de Compras:</span>
                <p className="leading-relaxed">{proveedor.notas}</p>
              </div>
            )}
          </div>

          {/* Footer del Drawer con Acciones */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 sticky bottom-0 z-10">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(proveedor.id)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cerrar
              </Button>

              <Button
                size="sm"
                onClick={() => onEdit(proveedor)}
                className="bg-[#0369A1] hover:bg-[#0284C7] text-white gap-1.5 text-xs font-bold"
              >
                <Edit2 className="w-4 h-4" /> Editar Proveedor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
