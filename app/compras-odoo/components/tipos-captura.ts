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
