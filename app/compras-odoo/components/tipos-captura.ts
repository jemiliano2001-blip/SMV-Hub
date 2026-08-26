import type { PartidaCotizacionOdoo } from '@/lib/schemas'

export interface ProveedorSugerido {
  id: number
  name: string
}

export interface OrdenTrabajoSugerida {
  id: number
  name: string
  clientOrderRef: string | null
  partnerId: number | null
  partnerName: string
  state: string
}

export interface TotalesCotizacion {
  subtotal: number
  iva: number
  total: number
}

export interface BorradorComprasOdoo {
  proveedor: string
  proveedorId: number | null
  referenciaProveedor: string
  moneda: 'MXN' | 'USD'
  fecha: string
  fechaRecepcion: string
  notas: string
  defaultRequisitor?: string
  defaultEmpresa?: string
  defaultUso?: string
  defaultOrdenTrabajo?: string
  defaultOrdenTrabajoId?: number | null
  defaultUdm?: string
  defaultImpuesto?: string
  defaultTasaIva?: number
  partidas: PartidaCotizacionOdoo[]
  guardadoEn: string
}
