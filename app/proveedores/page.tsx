'use client'

import { useState, useEffect, useMemo } from 'react'
import { fechaHoyLocal } from '@/lib/format'
import {
  Building2,
  Tag,
  Sparkles,
  Truck,
  ThumbsUp,
  FileCheck,
  Scale,
  Printer,
} from 'lucide-react'
import AuthGuard from '@/app/AuthGuard'
import PageShell from '@/components/layout/PageShell'
import ModuleTabs from '@/components/layout/ModuleTabs'
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
  CompraOdooItem,
} from '@/lib/schemas'
import type { NuevoProveedorPayload, MatrizBackupProveedores } from '@/lib/proveedores'
import { CATEGORIAS_PROVEEDOR_FORM } from '@/lib/proveedores/categorias-proveedor'
import { obtenerMatrizBackupProveedores } from '@/lib/proveedores'
import type { NuevaCompraPayload } from '@/lib/proveedores-inteligencia'
import PanelComprasOdoo from '@/app/proveedores/PanelComprasOdoo'
import HeaderCentroMando from './components/HeaderCentroMando'
import DirectorioProveedores from './components/DirectorioProveedores'
import DrawerDetalleProveedor from './components/DrawerDetalleProveedor'
import ModalInvestigacionPrecios from './components/ModalInvestigacionPrecios'
import { listarItemsComprasOdoo } from '@/lib/compras-odoo-store'
import { listarOrdenesEnRango } from '@/lib/ordenes'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const CATEGORIAS_OPCIONES = CATEGORIAS_PROVEEDOR_FORM

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
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Building2 className="h-5 w-5 text-primary" />
            {proveedorEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor (Compras USA / Tooling CNC)'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
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
              <label className="font-bold text-foreground">Nombre Comercial *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Shars Tool, OnlineCarbide, YG-1 USA..."
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Estatus</label>
              <select
                value={estatus}
                onChange={(e) => setEstatus(e.target.value as EstatusProveedor)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              >
                <option value="actual">Activo (Actual)</option>
                <option value="prospecto">Prospecto</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Nivel de Precio / Gama</label>
              <select
                value={tipoProveedor}
                onChange={(e) => {
                  const val = e.target.value as TipoProveedor
                  setTipoProveedor(val)
                  if (val === 'barato') setBarato(true)
                }}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold text-primary focus:outline-none focus:border-primary"
              >
                <option value="barato">Económico ($ Barato)</option>
                <option value="estandar">Estándar ($)</option>
                <option value="premium">Premium Industrial ($$$)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-sky-50 rounded-xl border border-sky-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
              <input
                type="checkbox"
                checked={barato}
                onChange={(e) => setBarato(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <Sparkles className="h-4 w-4 text-amber-500" />
              Marcar como Opción Económica ($ Barato)
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
              <input
                type="checkbox"
                checked={recomendado}
                onChange={(e) => setRecomendado(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              Proveedor Recomendado por Taller
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
              <input
                type="checkbox"
                checked={facturaUSD}
                onChange={(e) => setFacturaUSD(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <FileCheck className="h-4 w-4 text-sky-700" />
              Emite Invoice Fiscal en USD
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Categorías de Herramental *</label>
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
                        : 'bg-card text-foreground border-input hover:bg-muted',
                    ].join(' ')}
                  >
                    <Tag className="h-3 w-3" />
                    {etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-3 bg-muted rounded-xl border border-border space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-primary" /> Logística &amp; Aduanas EE.UU. &rarr; México
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Shipping Address en USA (Bodega / Crossing)</label>
                <input
                  type="text"
                  value={shippingAddressUSA}
                  onChange={(e) => setShippingAddressUSA(e.target.value)}
                  placeholder="Ej. 840 S Frontenac St, Aurora IL (Warehouse Laredo TX)"
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Broker Aduanal / Agencia Forwarder</label>
                <input
                  type="text"
                  value={brokerAduanal}
                  onChange={(e) => setBrokerAduanal(e.target.value)}
                  placeholder="Ej. Agencia Aduanal Rangel (Laredo, TX)"
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground">Métodos de Pago Aceptados</label>
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
                          ? 'bg-primary text-white border-primary font-bold'
                          : 'bg-card text-muted-foreground border-input hover:bg-muted',
                      ].join(' ')}
                    >
                      {etiqueta}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Tiempo de Respuesta</label>
              <select
                value={tiempoRespuesta}
                onChange={(e) => setTiempoRespuesta(e.target.value as TiempoRespuesta)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              >
                <option value="inmediato">Inmediato (&lt; 1 hora)</option>
                <option value="mismo_dia">Mismo día</option>
                <option value="24_48h">24 a 48 horas</option>
                <option value="lento">Lento (&gt; 48 horas)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Prioridad Interna</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Prioridad)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Contacto / At&apos;n</label>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Ej. Sales Dept / Mark Stevens"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Sitio Web</label>
              <input
                type="url"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
                placeholder="https://www.shars.com"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@proveedor.com"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Teléfono / WhatsApp</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Tel: +1 800-000-0000"
                  className="w-1/2 px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp..."
                  className="w-1/2 px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">País</label>
              <input
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                placeholder="Estados Unidos, México..."
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-foreground">Ubicación / Ciudad, Estado</label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej. Aurora, Illinois, USA"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground">Marcas Manejadas (separadas por coma)</label>
            <input
              type="text"
              value={marcasTexto}
              onChange={(e) => setMarcasTexto(e.target.value)}
              placeholder="Ej. YG-1, Shars, Korloy, OnlineCarbide, Deskar"
              className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Moneda</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as 'USD' | 'MXN')}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              >
                <option value="USD">USD ($)</option>
                <option value="MXN">MXN ($)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Lead Time (Días)</label>
              <input
                type="number"
                min="0"
                value={leadTimeDias}
                onChange={(e) => setLeadTimeDias(e.target.value)}
                placeholder="Ej. 4"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Pedido Mínimo ($)</label>
              <input
                type="number"
                min="0"
                value={pedidoMinimo}
                onChange={(e) => setPedidoMinimo(e.target.value)}
                placeholder="Ej. 50"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Calificación (1-5)</label>
              <select
                value={calificacion}
                onChange={(e) => setCalificacion(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              >
                <option value={5}>5 — Excelente</option>
                <option value={4}>4 — Bueno</option>
                <option value={3}>3 — Regular</option>
                <option value={2}>2 — Bajo</option>
                <option value={1}>1 — No recomendado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Notas Internas de Compras</label>
              <textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Detalles de descuento, observaciones sobre envíos, códigos de cupón, etc."
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Experiencia de Compra (Histórico de taller)</label>
              <textarea
                rows={3}
                value={experienciaCompra}
                onChange={(e) => setExperienciaCompra(e.target.value)}
                placeholder="Resumen de cómo llegó el paquete, rendimiento del cortador, atención a clientes..."
                className="w-full px-3 py-2 border border-input rounded-lg text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition-colors disabled:opacity-50"
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
  const [producto, setProducto] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProveedor>('endmills')
  const [marca, setMarca] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [precioUnitario, setPrecioUnitario] = useState(0)
  const [fleteUSD, setFleteUSD] = useState(0)
  const [leadTimeRealDias, setLeadTimeRealDias] = useState(0)
  const notas = ''

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
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Printer className="h-5 w-5 text-primary" /> Generar Orden de Compra Internacional (PO / PDF)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Genera e imprime el documento de compra formateado para proveedores de EE.UU. y registra en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs font-sans">
          {/* Datos Generales de la Orden */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Proveedor US</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold text-primary"
              >
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.ubicacion || p.pais})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">No. Orden / PO</label>
              <input
                type="text"
                value={numeroOrden}
                onChange={(e) => setNumeroOrden(e.target.value)}
                placeholder="PO-2026-001"
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaProveedor)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs"
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
              <label className="font-bold text-foreground">Descripción del Herramental</label>
              <input
                type="text"
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Marca</label>
              <input
                type="text"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Cantidad</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Precio Unitario ($ USD)</label>
              <input
                type="number"
                step="0.1"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Flete Estimado ($ USD)</label>
              <input
                type="number"
                step="0.1"
                value={fleteUSD}
                onChange={(e) => setFleteUSD(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Lead Time Est. (Días)</label>
              <input
                type="number"
                value={leadTimeRealDias}
                onChange={(e) => setLeadTimeRealDias(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-lg text-xs font-bold"
              />
            </div>
          </div>

          {/* VISTA PREVIA IMPRESIÓN PO */}
          {prov && (
            <div className="p-4 bg-card border border-input rounded-xl space-y-3 font-mono text-[11px] shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="font-bold text-foreground text-xs">SMV MAQUINADOS S.A. DE C.V.</h3>
                  <p className="text-[10px] text-muted-foreground">Monterrey, N.L. México | Compras Internacionales</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary">{numeroOrden}</span>
                  <p className="text-[10px] text-muted-foreground">{fechaHoyLocal()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-muted p-2 rounded border border-border">
                  <span className="font-bold text-foreground block uppercase">VENDOR / PROVEEDOR:</span>
                  <p className="font-bold text-foreground">{prov.nombre}</p>
                  <p className="text-muted-foreground">{prov.ubicacion || prov.pais}</p>
                </div>

                <div className="bg-sky-50 p-2 rounded border border-sky-200">
                  <span className="font-bold text-primary block uppercase">SHIP TO / BODEGA USA:</span>
                  <p className="font-bold text-foreground">{prov.shippingAddressUSA || 'Laredo TX Crossing Warehouse'}</p>
                  <p className="text-muted-foreground">Broker: {prov.brokerAduanal || 'Agencia Rangel'}</p>
                </div>
              </div>

              <div className="border border-border rounded overflow-hidden">
                <Table className="w-full text-left text-[10px]">
                  <TableHeader className="bg-muted text-muted-foreground font-bold border-b border-border">
                    <TableRow>
                      <TableHead className="px-2 py-1">Item / Descripción</TableHead>
                      <TableHead className="px-2 py-1">Cant</TableHead>
                      <TableHead className="px-2 py-1">P.U.</TableHead>
                      <TableHead className="px-2 py-1 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="px-2 py-1 font-sans">{producto} ({marca})</TableCell>
                      <TableCell className="px-2 py-1">{cantidad}</TableCell>
                      <TableCell className="px-2 py-1">${precioUnitario} USD</TableCell>
                      <TableCell className="px-2 py-1 text-right font-bold">${subtotal.toFixed(2)} USD</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border text-xs">
                <span className="font-bold text-foreground">TOTAL CON FLETE EST.:</span>
                <span className="font-black text-emerald-700 text-sm">${total.toFixed(2)} USD</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrintAndSave}
              className="px-4 py-2 font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Guardar e Imprimir Orden (PDF)
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── VISTA PRINCIPAL CON PESTAÑAS INTELIGENTES ─────────────────────────────────

function ProveedoresContent() {
  const [region, setRegion] = useState<'usa' | 'mexico'>('usa')
  const [seccion, setSeccion] = useState<'proveedores' | 'comparar'>('proveedores')

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

  const { crearCompra } = useProveedoresInteligencia({
    habilitado: false,
  })

  // Ventana de 12 meses para ModalInvestigacionPrecios (no full-scan).
  const [ordenesScorecard, setOrdenesScorecard] = useState<OrdenCompra[]>([])

  async function cargarScorecardsVentana() {
    try {
      const hasta = new Date()
      const desde = new Date()
      desde.setFullYear(desde.getFullYear() - 1)
      setOrdenesScorecard(await listarOrdenesEnRango(desde, hasta))
    } catch (err) {
      console.error('[proveedores] scorecards:', err)
      toast.error('No se pudieron cargar las órdenes para investigación de precios')
    }
  }

  const [modalFormAbierto, setModalFormAbierto] = useState(false)
  const [modalPOAbierto, setModalPOAbierto] = useState(false)
  const [modalInvestigacionAbierto, setModalInvestigacionAbierto] = useState(false)
  const [proveedorEditar, setProveedorEditar] = useState<Proveedor | null>(null)
  const [idEliminar, setIdEliminar] = useState<string | null>(null)
  const [itemsComprasOdoo, setItemsComprasOdoo] = useState<CompraOdooItem[]>([])

  useEffect(() => {
    if (!modalInvestigacionAbierto) return
    const timer = window.setTimeout(() => void cargarScorecardsVentana(), 0)
    return () => window.clearTimeout(timer)
  }, [modalInvestigacionAbierto])

  useEffect(() => {
    if (!modalInvestigacionAbierto) return
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
  }, [modalInvestigacionAbierto])

  useEffect(() => {
    if (!modalPOAbierto || catalogoCompleto || cargandoCatalogo) return
    void cargarCatalogoCompleto().catch((err) => {
      console.error('No se pudo cargar el catálogo completo de proveedores:', err)
      toast.error('No se pudo preparar el catálogo completo')
    })
  }, [cargarCatalogoCompleto, cargandoCatalogo, catalogoCompleto, modalPOAbierto])

  const totalProveedoresRegion = resumenProveedores[region]

  // Drawer lateral de detalle
  const [proveedorDetalle, setProveedorDetalle] = useState<Proveedor | null>(null)

  // Matriz de proveedor primario/backup por categoría — badges del directorio.
  const [mapeoBackup, setMapeoBackup] = useState<MatrizBackupProveedores>({})

  useEffect(() => {
    obtenerMatrizBackupProveedores()
      .then(setMapeoBackup)
      .catch((err) => console.error('Error cargando matriz de backup de proveedores:', err))
  }, [])

  const proveedoresPrimarios = useMemo(
    () => new Set(Object.values(mapeoBackup).map((m) => m.primarioId).filter(Boolean)),
    [mapeoBackup]
  )
  const proveedoresBackup = useMemo(
    () => new Set(Object.values(mapeoBackup).map((m) => m.backupId).filter(Boolean)),
    [mapeoBackup]
  )

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
    <PageShell>
        <HeaderCentroMando
          totalProveedores={totalProveedores}
          totalUSA={resumenProveedores.usa}
          totalMexico={resumenProveedores.mexico}
          sinMercado={resumenProveedores.sinMercado}
          mercadoActivo={region}
          onMercadoChange={(r) => setRegion(r)}
          onNuevoProveedor={abrirNuevo}
          onGenerarPDF={() => void abrirReportePO()}
          onAbrirInvestigacion={() => setModalInvestigacionAbierto(true)}
        />

        <ModuleTabs
          value={seccion}
          onValueChange={(v) => setSeccion(v as typeof seccion)}
          items={[
            {
              value: 'proveedores',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="size-4" aria-hidden />
                  Directorio ({totalProveedoresRegion}{resumenProveedores.sinMercado > 0 ? '+' : ''})
                </span>
              ),
              content: (
                <DirectorioProveedores
                  proveedores={proveedores}
                  mercado={region}
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
                  proveedoresPrimarios={proveedoresPrimarios}
                  proveedoresBackup={proveedoresBackup}
                />
              ),
            },
            {
              value: 'comparar',
              label: (
                <span className="inline-flex items-center gap-2">
                  <Scale className="size-4 text-emerald-600" aria-hidden />
                  Comparador de precios
                </span>
              ),
              content: <PanelComprasOdoo />,
            },
          ]}
        />

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

        {/* Modal Asistente de Investigación de Precios con Gemini 3.7 */}
        <ModalInvestigacionPrecios
          abierto={modalInvestigacionAbierto}
          onClose={() => setModalInvestigacionAbierto(false)}
          ordenesHistoricas={ordenesScorecard}
          itemsOdoo={itemsComprasOdoo}
        />
    </PageShell>
  )
}

export default function ProveedoresPage() {
  return (
    <AuthGuard>
      <ProveedoresContent />
    </AuthGuard>
  )
}
