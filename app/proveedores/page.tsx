'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fechaHoyLocal } from '@/lib/format'
import {
  Building2,
  X,
  Tag,
  Sparkles,
  Truck,
  Award,
  ThumbsUp,
  FileCheck,
  Scale,
  History,
  Zap,
  Printer,
  Brain,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react'
import AuthGuard from '@/app/AuthGuard'
import { useDirectorioProveedores } from '@/lib/hooks/useDirectorioProveedores'
import { useProveedoresInteligencia } from '@/lib/hooks/useProveedoresInteligencia'
import type {
  Proveedor,
  OrdenCompra,
  CategoriaProveedor,
  EstatusProveedor,
  TipoProveedor,
  MetodoPago,
  TiempoRespuesta,
  FrecuenciaCompra,
  Prioridad,
  EvaluacionProveedor,
  CompraOdooItem,
} from '@/lib/schemas'
import type { NuevoProveedorPayload } from '@/lib/proveedores'
import type { NuevaCompraPayload } from '@/lib/proveedores-inteligencia'
import SeccionRecomendacionInteligente from '@/app/requisiciones/SeccionRecomendacionInteligente'
import PanelComprasOdoo from '@/app/proveedores/PanelComprasOdoo'
import BandaRangoMetalConcepto from '@/app/proveedores/BandaRangoMetalConcepto'
import HeaderCentroMando from './components/HeaderCentroMando'
import DirectorioProveedores from './components/DirectorioProveedores'
import DrawerDetalleProveedor from './components/DrawerDetalleProveedor'
import PanelInteligencia360 from './components/PanelInteligencia360'
import { listarItemsComprasOdoo } from '@/lib/compras-odoo-store'
import { listarCotizaciones } from '@/lib/cotizaciones'
import { listarOrdenesEnRango } from '@/lib/ordenes'
import {
  ofertasDesdeHistorico,
  construirComparacionDesdeHistorico,
  generarScorecardsDesdeOrdenes,
  persistirScorecardsAutomaticas,
} from '@/lib/proveedores-inteligencia-cruzada'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import MisCasosBadge from './mis-casos/MisCasosBadge'

const CATEGORIAS_OPCIONES: { valor: CategoriaProveedor; etiqueta: string }[] = [
  { valor: 'endmills', etiqueta: 'Endmills (Cortadores CNC)' },
  { valor: 'insertos', etiqueta: 'Insertos de Torneado/Fresado' },
  { valor: 'tooling', etiqueta: 'Tooling & Conos (CAT40/BT40)' },
  { valor: 'consumibles', etiqueta: 'Consumibles de Taller' },
  { valor: 'otros', etiqueta: 'Otros / Misceláneo' },
]

const METODOS_PAGO_OPCIONES: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'tarjeta', etiqueta: 'Tarjeta Crédito/Débito' },
  { valor: 'transferencia', etiqueta: 'Transferencia (Wire/ACH)' },
  { valor: 'credito', etiqueta: 'Crédito Comercial (30 días)' },
  { valor: 'paypal', etiqueta: 'PayPal' },
]

// ── MODAL FORMULARIO PROVEEDOR ───────────────────────────────────────────────

function FormularioProveedorModal({
  abierto,
  onClose,
  onGuardar,
  proveedorEdicion,
}: {
  abierto: boolean
  onClose: () => void
  onGuardar: (payload: NuevoProveedorPayload) => Promise<void>
  proveedorEdicion: Proveedor | null
}) {
  const [nombre, setNombre] = useState(proveedorEdicion?.nombre ?? '')
  const [estatus, setEstatus] = useState<EstatusProveedor>(proveedorEdicion?.estatus ?? 'actual')
  const [tipoProveedor, setTipoProveedor] = useState<TipoProveedor>(proveedorEdicion?.tipoProveedor ?? 'estandar')
  const [barato, setBarato] = useState(proveedorEdicion?.barato ?? false)
  const [recomendado, setRecomendado] = useState(proveedorEdicion?.recomendado ?? false)
  const [categorias, setCategorias] = useState<CategoriaProveedor[]>(
    proveedorEdicion?.categorias ?? ['endmills']
  )
  const [pais, setPais] = useState(proveedorEdicion?.pais ?? 'Estados Unidos')
  const [ubicacion, setUbicacion] = useState(proveedorEdicion?.ubicacion ?? '')
  const [shippingAddressUSA, setShippingAddressUSA] = useState(proveedorEdicion?.shippingAddressUSA ?? '')
  const [brokerAduanal, setBrokerAduanal] = useState(proveedorEdicion?.brokerAduanal ?? '')
  const [web, setWeb] = useState(proveedorEdicion?.web ?? '')
  const [contacto, setContacto] = useState(proveedorEdicion?.contacto ?? '')
  const [email, setEmail] = useState(proveedorEdicion?.email ?? '')
  const [telefono, setTelefono] = useState(proveedorEdicion?.telefono ?? '')
  const [whatsapp, setWhatsapp] = useState(proveedorEdicion?.whatsapp ?? '')
  const [marcasTexto, setMarcasTexto] = useState(proveedorEdicion?.marcas.join(', ') ?? '')
  const [moneda, setMoneda] = useState<'USD' | 'MXN'>(proveedorEdicion?.moneda ?? 'USD')
  const [facturaUSD, setFacturaUSD] = useState(proveedorEdicion?.facturaUSD ?? true)
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>(proveedorEdicion?.metodosPago ?? ['tarjeta'])
  const [tiempoRespuesta, setTiempoRespuesta] = useState<TiempoRespuesta>(proveedorEdicion?.tiempoRespuesta ?? 'mismo_dia')
  // ponytail: el form ya no captura frecuencia; se preserva la del proveedor al editar
  const frecuenciaCompra: FrecuenciaCompra = proveedorEdicion?.frecuenciaCompra ?? 'mensual'
  const [prioridad, setPrioridad] = useState<Prioridad>(proveedorEdicion?.prioridad ?? 'media')
  const [leadTimeDias, setLeadTimeDias] = useState<string>(
    proveedorEdicion?.leadTimeDias ? String(proveedorEdicion.leadTimeDias) : ''
  )
  const [pedidoMinimo, setPedidoMinimo] = useState<string>(
    proveedorEdicion?.pedidoMinimo ? String(proveedorEdicion.pedidoMinimo) : ''
  )
  const [calificacion, setCalificacion] = useState<number>(proveedorEdicion?.calificacion ?? 5)
  const [notas, setNotas] = useState(proveedorEdicion?.notas ?? '')
  const [experienciaCompra, setExperienciaCompra] = useState(proveedorEdicion?.experienciaCompra ?? '')

  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  function toggleCategoria(cat: CategoriaProveedor) {
    setCategorias((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function toggleMetodoPago(mp: MetodoPago) {
    setMetodosPago((prev) =>
      prev.includes(mp) ? prev.filter((m) => m !== mp) : [...prev, mp]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setErrorForm('El nombre del proveedor es obligatorio.')
      return
    }
    if (categorias.length === 0) {
      setErrorForm('Selecciona al menos una categoría.')
      return
    }

    setGuardando(true)
    setErrorForm(null)

    try {
      const marcas = marcasTexto
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)

      await onGuardar({
        nombre: nombre.trim(),
        estatus,
        tipoProveedor,
        barato: tipoProveedor === 'barato' || barato,
        recomendado,
        categorias,
        pais: pais.trim() || 'Estados Unidos',
        ubicacion: ubicacion.trim(),
        shippingAddressUSA: shippingAddressUSA.trim(),
        brokerAduanal: brokerAduanal.trim(),
        web: web.trim(),
        contacto: contacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        whatsapp: whatsapp.trim(),
        marcas,
        moneda,
        facturaUSD,
        metodosPago,
        tiempoRespuesta,
        frecuenciaCompra,
        prioridad,
        leadTimeDias: leadTimeDias ? Number(leadTimeDias) : null,
        pedidoMinimo: pedidoMinimo ? Number(pedidoMinimo) : null,
        calificacion,
        notas: notas.trim(),
        experienciaCompra: experienciaCompra.trim(),
      })

      onClose()
    } catch (err) {
      console.error(err)
      setErrorForm('Error al guardar el proveedor. Revisa los datos.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Building2 className="h-5 w-5 text-[#0369A1]" />
            {proveedorEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor (Compras USA / Tooling CNC)'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Registra y gestiona proveedores internacionales para compras de endmills, insertos y herramental.
          </DialogDescription>
        </DialogHeader>

        {errorForm && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200">
            {errorForm}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">Nombre Comercial *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Shars Tool, OnlineCarbide, YG-1 USA..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Estatus</label>
              <select
                value={estatus}
                onChange={(e) => setEstatus(e.target.value as EstatusProveedor)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              >
                <option value="actual">Activo (Actual)</option>
                <option value="prospecto">Prospecto</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Nivel de Precio / Gama</label>
              <select
                value={tipoProveedor}
                onChange={(e) => {
                  const val = e.target.value as TipoProveedor
                  setTipoProveedor(val)
                  if (val === 'barato') setBarato(true)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-[#0369A1] focus:outline-none focus:border-[#0369A1]"
              >
                <option value="barato">Económico ($ Barato)</option>
                <option value="estandar">Estándar ($)</option>
                <option value="premium">Premium Industrial ($$$)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-sky-50 rounded-xl border border-sky-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#0369A1]">
              <input
                type="checkbox"
                checked={barato}
                onChange={(e) => setBarato(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1]"
              />
              <Sparkles className="h-4 w-4 text-amber-500" />
              Marcar como Opción Económica ($ Barato)
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#0369A1]">
              <input
                type="checkbox"
                checked={recomendado}
                onChange={(e) => setRecomendado(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1]"
              />
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              Proveedor Recomendado por Taller
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#0369A1]">
              <input
                type="checkbox"
                checked={facturaUSD}
                onChange={(e) => setFacturaUSD(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1]"
              />
              <FileCheck className="h-4 w-4 text-sky-700" />
              Emite Invoice Fiscal en USD
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Categorías de Herramental *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_OPCIONES.map(({ valor, etiqueta }) => {
                const selec = categorias.includes(valor)
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => toggleCategoria(valor)}
                    className={[
                      'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5',
                      selec
                        ? 'bg-sky-900 text-white border-sky-900 font-bold'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <Tag className="h-3 w-3" />
                    {etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[#0369A1]" /> Logística &amp; Aduanas EE.UU. &rarr; México
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Shipping Address en USA (Bodega / Crossing)</label>
                <input
                  type="text"
                  value={shippingAddressUSA}
                  onChange={(e) => setShippingAddressUSA(e.target.value)}
                  placeholder="Ej. 840 S Frontenac St, Aurora IL (Warehouse Laredo TX)"
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Broker Aduanal / Agencia Forwarder</label>
                <input
                  type="text"
                  value={brokerAduanal}
                  onChange={(e) => setBrokerAduanal(e.target.value)}
                  placeholder="Ej. Agencia Aduanal Rangel (Laredo, TX)"
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Métodos de Pago Aceptados</label>
              <div className="flex flex-wrap gap-1.5">
                {METODOS_PAGO_OPCIONES.map(({ valor, etiqueta }) => {
                  const selec = metodosPago.includes(valor)
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => toggleMetodoPago(valor)}
                      className={[
                        'px-2.5 py-1 rounded-md text-[11px] border transition-colors',
                        selec
                          ? 'bg-[#0369A1] text-white border-[#0369A1] font-bold'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {etiqueta}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Tiempo de Respuesta</label>
              <select
                value={tiempoRespuesta}
                onChange={(e) => setTiempoRespuesta(e.target.value as TiempoRespuesta)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              >
                <option value="inmediato">Inmediato (&lt; 1 hora)</option>
                <option value="mismo_dia">Mismo día</option>
                <option value="24_48h">24 a 48 horas</option>
                <option value="lento">Lento (&gt; 48 horas)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Prioridad Interna</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Contacto / At&apos;n</label>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Ej. Sales Dept / Mark Stevens"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Sitio Web</label>
              <input
                type="url"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
                placeholder="https://www.shars.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@proveedor.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Teléfono / WhatsApp</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Tel: +1 800-000-0000"
                  className="w-1/2 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
                />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp..."
                  className="w-1/2 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">País</label>
              <input
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                placeholder="Estados Unidos, México..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">Ubicación / Ciudad, Estado</label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej. Aurora, Illinois, USA"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Marcas Manejadas (separadas por coma)</label>
            <input
              type="text"
              value={marcasTexto}
              onChange={(e) => setMarcasTexto(e.target.value)}
              placeholder="Ej. YG-1, Shars, Korloy, OnlineCarbide, Deskar"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Moneda</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'USD' | 'MXN')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              >
                <option value="USD">USD ($)</option>
                <option value="MXN">MXN ($)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Lead Time (Días)</label>
              <input
                type="number"
                min="0"
                value={leadTimeDias}
                onChange={(e) => setLeadTimeDias(e.target.value)}
                placeholder="Ej. 4"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Pedido Mínimo ($)</label>
              <input
                type="number"
                min="0"
                value={pedidoMinimo}
                onChange={(e) => setPedidoMinimo(e.target.value)}
                placeholder="Ej. 50"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Calificación (1-5)</label>
              <select
                value={calificacion}
                onChange={(e) => setCalificacion(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5 - Excelente)</option>
                <option value={4}>⭐⭐⭐⭐ (4 - Bueno)</option>
                <option value={3}>⭐⭐⭐ (3 - Regular)</option>
                <option value={2}>⭐⭐ (2 - Bajo)</option>
                <option value={1}>⭐ (1 - No recomendado)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Notas Internas de Compras</label>
              <textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Detalles de descuento, observaciones sobre envíos, códigos de cupón, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Experiencia de Compra (Histórico de taller)</label>
              <textarea
                rows={3}
                value={experienciaCompra}
                onChange={(e) => setExperienciaCompra(e.target.value)}
                placeholder="Resumen de cómo llegó el paquete, rendimiento del cortador, atención a clientes..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#0369A1]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0369A1] hover:bg-[#0284C7] rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : proveedorEdicion ? 'Actualizar' : 'Guardar Proveedor'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── MODAL GENERADOR Y EXPORTADOR DE ORDEN DE COMPRA (PO / PDF) ─────────────────

function GenerarPOModal({
  abierto,
  onClose,
  proveedores,
  onCrearCompra,
}: {
  abierto: boolean
  onClose: () => void
  proveedores: Proveedor[]
  onCrearCompra: (payload: NuevaCompraPayload) => Promise<unknown>
}) {
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? '')
  const [numeroOrden, setNumeroOrden] = useState('')
  const [producto, setProducto] = useState('Endmill Carburo Sólido 1/2" 4 Gavilanes AlTiN')
  const [categoria, setCategoria] = useState<CategoriaProveedor>('endmills')
  const [marca, setMarca] = useState('Shars')
  const [cantidad, setCantidad] = useState(5)
  const [precioUnitario, setPrecioUnitario] = useState(24.5)
  const [fleteUSD, setFleteUSD] = useState(15.0)
  const [leadTimeRealDias, setLeadTimeRealDias] = useState(4)
  const notas = 'Envío urgente a bodega de Laredo, Texas para despacho aduanal.'

  const prov = proveedores.find((p) => p.id === proveedorId) || proveedores[0]
  const subtotal = cantidad * precioUnitario
  const total = subtotal + fleteUSD

  async function handlePrintAndSave() {
    try {
      if (prov) {
        await onCrearCompra({
          proveedorId: prov.id,
          proveedorNombre: prov.nombre,
          numeroOrden,
          fecha: fechaHoyLocal(),
          producto,
          categoria,
          marca: marca || prov.marcas[0] || '',
          cantidad,
          precioUnitario,
          moneda: 'USD',
          costoTotal: total,
          leadTimeRealDias,
          notas,
        })
      }
      window.print()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo guardar la orden de compra. Intenta de nuevo.')
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Printer className="h-5 w-5 text-[#0369A1]" /> Generar Orden de Compra Internacional (PO / PDF)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Genera e imprime el documento de compra formateado para proveedores de EE.UU. y registra en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs font-sans">
          {/* Datos Generales de la Orden */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Proveedor US</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-[#0369A1]"
              >
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.ubicacion || p.pais})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">No. Orden / PO</label>
              <input
                type="text"
                value={numeroOrden}
                onChange={(e) => setNumeroOrden(e.target.value)}
                placeholder="PO-2026-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaProveedor)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="endmills">Endmills</option>
                <option value="insertos">Insertos</option>
                <option value="tooling">Tooling &amp; Conos</option>
                <option value="consumibles">Consumibles</option>
              </select>
            </div>
          </div>

          {/* Producto, Cantidad, Precio */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">Descripción del Herramental</label>
              <input
                type="text"
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Marca</label>
              <input
                type="text"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Cantidad</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Precio Unitario ($ USD)</label>
              <input
                type="number"
                step="0.1"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Flete Estimado ($ USD)</label>
              <input
                type="number"
                step="0.1"
                value={fleteUSD}
                onChange={(e) => setFleteUSD(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Lead Time Est. (Días)</label>
              <input
                type="number"
                value={leadTimeRealDias}
                onChange={(e) => setLeadTimeRealDias(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          {/* VISTA PREVIA IMPRESIÓN PO */}
          {prov && (
            <div className="p-4 bg-white border border-slate-300 rounded-xl space-y-3 font-mono text-[11px] shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs">SMV MAQUINADOS S.A. DE C.V.</h3>
                  <p className="text-[10px] text-slate-500">Monterrey, N.L. México | Compras Internacionales</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#0369A1]">{numeroOrden}</span>
                  <p className="text-[10px] text-slate-400">{fechaHoyLocal()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="font-bold text-slate-700 block uppercase">VENDOR / PROVEEDOR:</span>
                  <p className="font-bold text-slate-900">{prov.nombre}</p>
                  <p className="text-slate-500">{prov.ubicacion || prov.pais}</p>
                </div>

                <div className="bg-sky-50 p-2 rounded border border-sky-200">
                  <span className="font-bold text-[#0369A1] block uppercase">SHIP TO / BODEGA USA:</span>
                  <p className="font-bold text-slate-900">{prov.shippingAddressUSA || 'Laredo TX Crossing Warehouse'}</p>
                  <p className="text-slate-600">Broker: {prov.brokerAduanal || 'Agencia Rangel'}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-1">Item / Descripción</th>
                      <th className="px-2 py-1">Cant</th>
                      <th className="px-2 py-1">P.U.</th>
                      <th className="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 font-sans">{producto} ({marca})</td>
                      <td className="px-2 py-1">{cantidad}</td>
                      <td className="px-2 py-1">${precioUnitario} USD</td>
                      <td className="px-2 py-1 text-right font-bold">${subtotal.toFixed(2)} USD</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                <span className="font-bold text-slate-700">TOTAL CON FLETE EST.:</span>
                <span className="font-black text-emerald-700 text-sm">${total.toFixed(2)} USD</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrintAndSave}
              className="px-4 py-2 font-bold text-white bg-[#0369A1] hover:bg-[#0284C7] rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Guardar e Imprimir Orden (PDF)
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── MODAL SCORECARD EVALUACIÓN PROVEEDOR ─────────────────────────────────────

function ScorecardModal({
  abierto,
  onClose,
  proveedor,
  evaluacionExistente,
  onGuardarEvaluacion,
}: {
  abierto: boolean
  onClose: () => void
  proveedor: Proveedor
  evaluacionExistente?: EvaluacionProveedor
  onGuardarEvaluacion: (payload: Omit<EvaluacionProveedor, 'id' | 'creadoEn'>) => Promise<unknown>
}) {
  const [precio, setPrecio] = useState(evaluacionExistente?.precio ?? 4)
  const [tiempoEntrega, setTiempoEntrega] = useState(evaluacionExistente?.tiempoEntrega ?? 4)
  const [calidad, setCalidad] = useState(evaluacionExistente?.calidad ?? 5)
  const [respuestaComunicacion, setRespuestaComunicacion] = useState(evaluacionExistente?.respuestaComunicacion ?? 4)
  const [cumplimiento, setCumplimiento] = useState(evaluacionExistente?.cumplimiento ?? 5)
  const [facilidadCompra, setFacilidadCompra] = useState(evaluacionExistente?.facilidadCompra ?? 4)
  const [fortalezasText, setFortalezasText] = useState(evaluacionExistente?.fortalezas.join(', ') ?? '')
  const [debilidadesText, setDebilidadesText] = useState(evaluacionExistente?.debilidades.join(', ') ?? '')
  const [guardando, setGuardando] = useState(false)

  const promedio = Number(
    ((precio + tiempoEntrega + calidad + respuestaComunicacion + cumplimiento + facilidadCompra) / 6).toFixed(1)
  )

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      const fortalezas = fortalezasText.split(',').map((s) => s.trim()).filter(Boolean)
      const debilidades = debilidadesText.split(',').map((s) => s.trim()).filter(Boolean)

      await onGuardarEvaluacion({
        proveedorId: proveedor.id,
        precio,
        tiempoEntrega,
        calidad,
        respuestaComunicacion,
        cumplimiento,
        facilidadCompra,
        promedioGeneral: promedio,
        fortalezas,
        debilidades,
        fechaEvaluacion: fechaHoyLocal(),
        evaluadoPor: 'Equipo de Compras SMV',
      })
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Award className="h-5 w-5 text-purple-600" /> Scorecard Interno: {proveedor.nombre}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Evaluación operativa del proveedor en 6 métricas clave de compras.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 text-xs font-sans">
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-purple-900 uppercase">Promedio General Ponderado</span>
              <p className="text-xs text-purple-700">Calculado a partir de las 6 dimensiones</p>
            </div>
            <span className="text-2xl font-black font-mono text-purple-900 bg-white px-3 py-1 rounded-lg border border-purple-300">
              {promedio} / 5.0 ⭐
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">1. Competitividad de Precio (1-5)</label>
              <select
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Precios muy económicos / directo fábrica</option>
                <option value={4}>4 - Precio competitivo estándar</option>
                <option value={3}>3 - Promedio de mercado</option>
                <option value={2}>2 - Costo elevado</option>
                <option value={1}>1 - Muy caro</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">2. Tiempo de Entrega / Lead Time (1-5)</label>
              <select
                value={tiempoEntrega}
                onChange={(e) => setTiempoEntrega(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Entrega ultra rápida (&lt; 3 días)</option>
                <option value={4}>4 - Cumple tiempo estándar (3-5 días)</option>
                <option value={3}>3 - Aceptable (5-7 días)</option>
                <option value={2}>2 - Frecuentes demoras</option>
                <option value={1}>1 - Demasiado lento</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">3. Calidad del Herramental (1-5)</label>
              <select
                value={calidad}
                onChange={(e) => setCalidad(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Excelente durabilidad y acabado</option>
                <option value={4}>4 - Buena calidad comprobada</option>
                <option value={3}>3 - Calidad aceptable</option>
                <option value={2}>2 - Desgaste prematuro</option>
                <option value={1}>1 - Mala calidad / Rompe fácil</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">4. Respuesta &amp; Comunicación (1-5)</label>
              <select
                value={respuestaComunicacion}
                onChange={(e) => setRespuestaComunicacion(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Respuesta inmediata por correo/web</option>
                <option value={4}>4 - Responde en el mismo día</option>
                <option value={3}>3 - Responde en 24h</option>
                <option value={2}>2 - Difícil de contactar</option>
                <option value={1}>1 - Sin atención a clientes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">5. Cumplimiento de Orden (1-5)</label>
              <select
                value={cumplimiento}
                onChange={(e) => setCumplimiento(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Cero errores en envíos</option>
                <option value={4}>4 - Muy pocos detalles de empaque</option>
                <option value={3}>3 - Ocasionales piezas faltantes</option>
                <option value={2}>2 - Errores constantes de ítem</option>
                <option value={1}>1 - Incierto</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">6. Facilidad de Compra &amp; Pago (1-5)</label>
              <select
                value={facilidadCompra}
                onChange={(e) => setFacilidadCompra(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={5}>5 - Invoice USD, tarjeta, crédito y portal</option>
                <option value={4}>4 - Buen flujo de pago</option>
                <option value={3}>3 - Proceso regular</option>
                <option value={2}>2 - Restricciones de tarjeta</option>
                <option value={1}>1 - Proceso muy complejo</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Fortalezas Destacadas (separadas por coma)</label>
            <input
              type="text"
              value={fortalezasText}
              onChange={(e) => setFortalezasText(e.target.value)}
              placeholder="Ej. Envío directo a Laredo, Excelente recubrimiento ZrN, Soporte técnico en minutos"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Debilidades o Áreas de Mejora (separadas por coma)</label>
            <input
              type="text"
              value={debilidadesText}
              onChange={(e) => setDebilidadesText(e.target.value)}
              placeholder="Ej. Pedido mínimo de $100 USD, Pocos insertos de cerámica"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar Scorecard'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── VISTA PRINCIPAL CON PESTAÑAS INTELIGENTES ─────────────────────────────────

function ProveedoresContent() {
  const [region, setRegion] = useState<'usa' | 'mexico'>('usa')
  const [seccion, setSeccion] = useState<'proveedores' | 'comparar' | 'inteligencia'>('proveedores')

  const {
    proveedores,
    catalogoCompleto,
    cargando: cargandoProv,
    cargandoMas,
    cargandoCatalogo,
    error: errorProv,
    hayMas,
    resumen: resumenProveedores,
    busqueda,
    setBusqueda,
    filtroCategoria,
    setFiltroCategoria,
    orden,
    setOrden,
    crearProveedor,
    editarProveedor,
    eliminarProveedor,
    cargarMas,
    cargarCatalogoCompleto,
    recargar: recargarProveedores,
  } = useDirectorioProveedores({ mercado: region })

  const todosProveedores = useMemo(() => catalogoCompleto ?? [], [catalogoCompleto])

  const {
    todasCompras,
    evaluaciones,
    cotizaciones,
    cargando: cargandoIntel,
    crearCompra,
    guardarEvaluacion,
    crearCotizacion,
    sincronizarOrdenes,
  } = useProveedoresInteligencia()

  // Filtrar estrictamente compras y cotizaciones con precio > 0 (omitir 0s)
  const comprasConPrecio = useMemo(() => {
    return todasCompras.filter(
      (c) => (c.precioUnitario && c.precioUnitario > 0) || (c.costoTotal && c.costoTotal > 0)
    )
  }, [todasCompras])

  const cotizacionesFiltradas = useMemo(() => {
    return cotizaciones
      .map((cot) => ({
        ...cot,
        ofertas: cot.ofertas.filter((o) => o.precioUnitario > 0),
        ofertasRanking: cot.ofertasRanking.filter((o) => o.precioUnitario > 0),
      }))
      .filter((cot) => cot.ofertas.length > 0)
  }, [cotizaciones])

  // Scorecards: ventana de 12 meses (no full-scan). Botón refresca la misma ventana.
  const [ordenesScorecard, setOrdenesScorecard] = useState<OrdenCompra[]>([])
  const [cargandoScorecards, setCargandoScorecards] = useState(false)

  async function cargarScorecardsVentana() {
    setCargandoScorecards(true)
    try {
      const hasta = new Date()
      const desde = new Date()
      desde.setFullYear(desde.getFullYear() - 1)
      setOrdenesScorecard(await listarOrdenesEnRango(desde, hasta))
    } catch (err) {
      console.error('[proveedores] scorecards:', err)
      toast.error('No se pudieron cargar las órdenes para scorecards')
    } finally {
      setCargandoScorecards(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void cargarScorecardsVentana(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const [modalFormAbierto, setModalFormAbierto] = useState(false)
  const [modalPOAbierto, setModalPOAbierto] = useState(false)
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | null>(null)
  const [idEliminar, setIdEliminar] = useState<string | null>(null)

  // Estado para la sincronización desde 'ordenes'
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState<string | null>(null)
  const [conceptoHistorico, setConceptoHistorico] = useState('')
  const [categoriaHistorico, setCategoriaHistorico] = useState<CategoriaProveedor>('endmills')
  const [cargandoHistorico, setCargandoHistorico] = useState(false)
  const [itemsComprasOdoo, setItemsComprasOdoo] = useState<CompraOdooItem[]>([])

  useEffect(() => {
    if (region !== 'mexico' && seccion !== 'comparar') return
    let cancelado = false
    void listarItemsComprasOdoo()
      .then((lista) => {
        if (!cancelado) setItemsComprasOdoo(lista)
      })
      .catch(() => {
        if (!cancelado) setItemsComprasOdoo([])
      })
    return () => {
      cancelado = true
    }
  }, [region, seccion])

  useEffect(() => {
    const requiereCatalogo = seccion !== 'proveedores' || modalPOAbierto
    if (!requiereCatalogo || catalogoCompleto || cargandoCatalogo) return
    void cargarCatalogoCompleto().catch((err) => {
      console.error('No se pudo cargar el catálogo completo de proveedores:', err)
      toast.error('No se pudo preparar el catálogo completo')
    })
  }, [cargarCatalogoCompleto, cargandoCatalogo, catalogoCompleto, modalPOAbierto, seccion])

  const catalogoRegion = todosProveedores.filter((p) => p.mercado === region)
  const totalProveedoresRegion = resumenProveedores[region]

  async function handleComparadorDesdeHistorico() {
    if (!conceptoHistorico.trim()) {
      toast.error('Escribe un concepto o número de parte')
      return
    }
    setCargandoHistorico(true)
    try {
      const catalogo = await cargarCatalogoCompleto()
      const historico = await listarCotizaciones()
      const ofertas = ofertasDesdeHistorico(
        conceptoHistorico.trim(),
        conceptoHistorico.trim(),
        historico,
        catalogo
      )
      if (ofertas.length === 0) {
        toast.error('No hay cotizaciones históricas que coincidan')
        return
      }
      const payload = construirComparacionDesdeHistorico(
        conceptoHistorico.trim(),
        categoriaHistorico,
        ofertas
      )
      await crearCotizacion(payload)
      toast.success(`Comparador creado con ${ofertas.length} ofertas desde histórico`)
      setConceptoHistorico('')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo crear el comparador desde histórico')
    } finally {
      setCargandoHistorico(false)
    }
  }

  async function handleSincronizarOrdenes() {
    setSincronizando(true)
    setMensajeSync(null)
    try {
      const res = await sincronizarOrdenes()
      if (res.importadas === 0) {
        setMensajeSync('Las compras de la sección Ver Órdenes ya se encuentran sincronizadas.')
      } else {
        setMensajeSync(`¡Éxito! Se importaron ${res.importadas} compras históricas a ${res.proveedoresAfectados} proveedores.`)
      }
    } catch (err) {
      console.error(err)
      setMensajeSync('Error al sincronizar con la sección de Órdenes.')
    } finally {
      setSincronizando(false)
    }
  }

  // Scorecard modal y drawer lateral
  const [proveedorScorecard, setProveedorScorecard] = useState<Proveedor | null>(null)
  const [proveedorDetalle, setProveedorDetalle] = useState<Proveedor | null>(null)
  const [guardandoScorecards, setGuardandoScorecards] = useState(false)

  const scorecardsAuto = useMemo(() => {
    return generarScorecardsDesdeOrdenes(ordenesScorecard, todasCompras, todosProveedores)
  }, [ordenesScorecard, todasCompras, todosProveedores])

  const leadTimePromedio = useMemo(() => {
    const tiempos = todasCompras
      .map((compra) => compra.leadTimeRealDias)
      .filter((tiempo): tiempo is number => typeof tiempo === 'number' && tiempo >= 0)
    if (tiempos.length === 0) return undefined
    return tiempos.reduce((suma, tiempo) => suma + tiempo, 0) / tiempos.length
  }, [todasCompras])

  async function handleGenerarScorecards() {
    if (scorecardsAuto.length === 0) {
      toast.error('No hay compras suficientes registradas para generar scorecards')
      return
    }
    setGuardandoScorecards(true)
    try {
      const guardadas = await persistirScorecardsAutomaticas(scorecardsAuto)
      toast.success(`Se guardaron ${guardadas} scorecards en la base de datos`)
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar scorecards')
    } finally {
      setGuardandoScorecards(false)
    }
  }

  const totalProveedores = resumenProveedores.total

  function abrirNuevo() {
    setProveedorEditar(null)
    setModalFormAbierto(true)
  }

  async function abrirReportePO() {
    const toastId = toast.loading('Preparando catálogo para el reporte…')
    try {
      await cargarCatalogoCompleto()
      toast.dismiss(toastId)
      setModalPOAbierto(true)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo preparar el reporte PO', { id: toastId })
    }
  }

  function abrirEditar(p: Proveedor) {
    setProveedorEditar(p)
    setModalFormAbierto(true)
  }

  async function handleConfirmarEliminar() {
    if (!idEliminar) return
    try {
      await eliminarProveedor(idEliminar)
      toast.success('Proveedor eliminado')
      if (proveedorDetalle?.id === idEliminar) {
        setProveedorDetalle(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('No se pudo eliminar el proveedor')
    } finally {
      setIdEliminar(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Cabecera Principal y Centro de Mando Hero */}
        <HeaderCentroMando
          totalProveedores={totalProveedores}
          totalUSA={resumenProveedores.usa}
          totalMexico={resumenProveedores.mexico}
          sinMercado={resumenProveedores.sinMercado}
          mercadoActivo={region}
          onMercadoChange={(r) => setRegion(r)}
          onNuevoProveedor={abrirNuevo}
          onGenerarPDF={() => void abrirReportePO()}
          leadTimePromedio={leadTimePromedio}
        />

        {/* Navegación por Pestañas Principales */}
        <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200 bg-white p-1.5 rounded-xl shadow-2xs text-xs font-bold">
          <Link
            href="/proveedores/mis-casos"
            className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2.5 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]"
          >
            <ClipboardCheck className="h-4 w-4 text-[#0369A1]" />
            Mis casos
            <MisCasosBadge />
          </Link>

          <button
            type="button"
            onClick={() => setSeccion('proveedores')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all ${
              seccion === 'proveedores'
                ? 'bg-[#0369A1] text-white shadow-xs font-extrabold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 className="h-4 w-4" /> Directorio Proveedores ({totalProveedoresRegion}{resumenProveedores.sinMercado > 0 ? '+' : ''})
          </button>

          <button
            type="button"
            onClick={() => setSeccion('comparar')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all ${
              seccion === 'comparar'
                ? 'bg-[#0369A1] text-white shadow-xs font-extrabold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Scale className="h-4 w-4 text-emerald-500" /> Comparador de Precios
          </button>

          <button
            type="button"
            onClick={() => setSeccion('inteligencia')}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all ${
              seccion === 'inteligencia'
                ? 'bg-[#0369A1] text-white shadow-xs font-extrabold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Brain className="h-4 w-4 text-violet-500" /> Inteligencia 360° &amp; Contingencia
          </button>
        </div>

        {/* PESTAÑA 1: DIRECTORIO DE PROVEEDORES */}
        {seccion === 'proveedores' && (
          <DirectorioProveedores
            proveedores={proveedores}
            cargando={cargandoProv}
            cargandoMas={cargandoMas}
            error={errorProv}
            hayMas={hayMas}
            totalMercado={resumenProveedores.sinMercado === 0 ? totalProveedoresRegion : undefined}
            onRetry={() => void recargarProveedores()}
            onCargarMas={() => void cargarMas()}
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            categoriaFiltro={filtroCategoria}
            onCategoriaChange={setFiltroCategoria}
            ordenamiento={orden}
            onOrdenamientoChange={setOrden}
            onSelectProveedor={(prov) => setProveedorDetalle(prov)}
            onEditProveedor={abrirEditar}
          />
        )}
        {/* PESTAÑA 2: COMPARADOR INTELIGENTE DE COTIZACIONES */}
        {(seccion === 'comparar' && region === 'usa') && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-emerald-600" />
                    Comparador Inteligente de Cotizaciones SMV
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ranking automatizado considerando 40% Precio, 30% Lead Time y 30% Scorecard del Proveedor.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Concepto / No. parte</label>
                  <input
                    type="text"
                    value={conceptoHistorico}
                    onChange={(e) => setConceptoHistorico(e.target.value)}
                    placeholder="Ej. Endmill 1/2 AlTiN"
                    className="w-full mt-0.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría</label>
                  <select
                    value={categoriaHistorico}
                    onChange={(e) => setCategoriaHistorico(e.target.value as CategoriaProveedor)}
                    className="mt-0.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                  >
                    <option value="endmills">Endmills</option>
                    <option value="insertos">Insertos</option>
                    <option value="tooling">Tooling</option>
                    <option value="consumibles">Consumibles</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void handleComparadorDesdeHistorico()}
                  disabled={cargandoHistorico}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {cargandoHistorico ? 'Cargando…' : 'Crear desde histórico'}
                </button>
              </div>
            </div>

            {cargandoIntel ? (
              <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Cargando cotizaciones de comparación...</div>
            ) : cotizacionesFiltradas.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <Scale className="h-10 w-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">Sin escenarios de cotización registrados</h3>
              </div>
            ) : (
              <div className="space-y-6">
                {cotizacionesFiltradas.map((cot) => (
                  <div key={cot.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-sky-50 text-[#0369A1] px-2 py-0.5 rounded border border-sky-200 uppercase">
                          Escenario: {cot.categoria}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 mt-1">{cot.concepto}</h3>
                        <BandaRangoMetalConcepto concepto={cot.concepto} items={itemsComprasOdoo} />
                      </div>
                      <span className="text-xs font-mono text-slate-400">Fecha: {cot.fecha}</span>
                    </div>

                    <SeccionRecomendacionInteligente
                      ofertas={cot.ofertas.map((of) => ({
                        proveedorId: of.proveedorId,
                        proveedorNombre: of.proveedorNombre,
                        precioTotal: of.precioUnitario,
                        moneda: of.moneda,
                        leadTimeDias: of.leadTimeDias,
                        observaciones: of.notas,
                      }))}
                      proveedoresCatalogo={todosProveedores}
                      evaluacionesHistoricas={evaluaciones}
                      comprasHistoricas={comprasConPrecio}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {cot.ofertasRanking.map((of) => (
                        <div
                          key={of.proveedorId}
                          className={[
                            'border rounded-xl p-4 flex flex-col justify-between space-y-3 relative',
                            of.esMejorBalance
                              ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                              : 'bg-slate-50/60 border-slate-200',
                          ].join(' ')}
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-1 mb-2">
                              {of.esMejorBalance && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                                  <Zap className="h-3 w-3" /> #1 Mejor Balance ⭐
                                </span>
                              )}
                              {of.esMejorPrecio && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1">
                                  💰 Mejor Precio
                                </span>
                              )}
                              {of.esMasRapido && (
                                <span className="bg-sky-100 text-[#0369A1] border border-sky-300 text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1">
                                  ⚡ Más Rápido
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-extrabold text-slate-900">{of.proveedorNombre}</h4>
                              <span className="text-xs font-mono font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {of.scoreCalculado} pts
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">Marca: {of.marca || 'Estándar'}</p>

                            <div className="mt-3 space-y-1.5 text-xs font-mono">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Precio Unitario:</span>
                                <span className="font-extrabold text-slate-900 text-sm">
                                  ${of.precioUnitario} {of.moneda}
                                </span>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Lead Time:</span>
                                <span className="font-bold text-slate-800">{of.leadTimeDias} días</span>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Pedido Mínimo:</span>
                                <span className="font-medium text-slate-700">{of.MOQ} pz(s)</span>
                              </div>
                            </div>

                            {of.notas && (
                              <p className="mt-2.5 text-[11px] text-slate-600 bg-white p-2 rounded-md border border-slate-200 leading-snug">
                                {of.notas}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: HISTORIAL DE COMPRAS */}
        {(seccion === 'comparar' && region === 'usa') && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-amber-600" />
                  Historial Registrado de Compras a Proveedores US
                </h2>
                <p className="text-xs text-slate-500">
                  Registro histórico de compras de endmills, insertos y accesorios para el taller de SMV Maquinados.
                </p>
              </div>

              <button
                onClick={handleSincronizarOrdenes}
                disabled={sincronizando}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar desde Ver Órdenes'}
              </button>
            </div>

            {mensajeSync && (
              <div className="p-3 bg-sky-50 border border-sky-200 text-[#0369A1] text-xs font-bold rounded-xl flex items-center justify-between">
                <span>{mensajeSync}</span>
                <button onClick={() => setMensajeSync(null)} className="p-1 hover:bg-sky-100 rounded">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Fecha / Orden</th>
                      <th className="px-4 py-3">Proveedor</th>
                      <th className="px-4 py-3">Producto / Herramienta</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Cant.</th>
                      <th className="px-4 py-3">P. Unitario</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Lead Time Real</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {comprasConPrecio.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors font-mono text-[11px]">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{c.fecha}</span>
                          <span className="text-[10px] text-slate-400">{c.numeroOrden}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{c.proveedorNombre}</td>
                        <td className="px-4 py-3 font-sans font-semibold text-slate-900">{c.producto}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                            {c.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{c.cantidad}</td>
                        <td className="px-4 py-3">${c.precioUnitario} {c.moneda}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-700">${c.costoTotal} {c.moneda}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{c.leadTimeRealDias} días</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: INTELIGENCIA 360° & CONTINGENCIA */}
        {seccion === 'inteligencia' && cargandoCatalogo && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500">
            Preparando el catálogo para Inteligencia 360°…
          </div>
        )}
        {seccion === 'inteligencia' && !cargandoCatalogo && catalogoCompleto && (
          <PanelInteligencia360
            proveedores={catalogoRegion}
            scorecards={scorecardsAuto}
            onGenerarScorecards={handleGenerarScorecards}
            guardandoScorecards={guardandoScorecards}
            onActualizarVentanaScorecards={() => void cargarScorecardsVentana()}
            cargandoVentanaScorecards={cargandoScorecards}
          />
        )}

        {/* MÉXICO — comparar precios (rangos Odoo) */}
        {seccion === 'comparar' && region === 'mexico' && (
          <PanelComprasOdoo mostrarSync={false} tituloRangos="Comparar precios MX (Odoo)" />
        )}

        {/* Drawer Lateral de Detalle / Master-Detail */}
        <DrawerDetalleProveedor
          open={!!proveedorDetalle}
          proveedor={proveedorDetalle}
          onClose={() => setProveedorDetalle(null)}
          onEdit={(prov) => {
            setProveedorDetalle(null)
            abrirEditar(prov)
          }}
          onDelete={(id) => setIdEliminar(id)}
        />

        {/* Modal Formulario Proveedor */}
        <FormularioProveedorModal
          abierto={modalFormAbierto}
          onClose={() => setModalFormAbierto(false)}
          onGuardar={async (payload) => {
            if (proveedorEditar) {
              await editarProveedor(proveedorEditar.id, payload)
              toast.success('Proveedor actualizado')
            } else {
              await crearProveedor({ ...payload, mercado: region })
              toast.success('Proveedor creado')
            }
          }}
          proveedorEdicion={proveedorEditar}
        />

        {/* Modal Generar PO Imprimible */}
        {catalogoCompleto && (
          <GenerarPOModal
            abierto={modalPOAbierto}
            onClose={() => setModalPOAbierto(false)}
            proveedores={catalogoCompleto}
            onCrearCompra={crearCompra}
          />
        )}

        {/* Modal Scorecard Evaluacion */}
        {proveedorScorecard && (
          <ScorecardModal
            abierto={!!proveedorScorecard}
            onClose={() => setProveedorScorecard(null)}
            proveedor={proveedorScorecard}
            evaluacionExistente={evaluaciones.find((e) => e.proveedorId === proveedorScorecard.id)}
            onGuardarEvaluacion={guardarEvaluacion}
          />
        )}

        {/* Modal Confirmar Eliminar */}
        <AlertDialog open={!!idEliminar} onOpenChange={(val) => !val && setIdEliminar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el proveedor del catálogo de compras. No se borrarán compras previas registradas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmarEliminar}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}

export default function ProveedoresPage() {
  return (
    <AuthGuard>
      <ProveedoresContent />
    </AuthGuard>
  )
}
