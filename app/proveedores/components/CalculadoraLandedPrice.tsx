'use client'

import { useState } from 'react'
import {
  Calculator,
  DollarSign,
  ShieldCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface CalculadoraLandedPriceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CalculadoraLandedPrice({
  open,
  onOpenChange,
}: CalculadoraLandedPriceProps) {
  const [precioBaseUSD, setPrecioBaseUSD] = useState<number>(45.0)
  const [cantidad, setCantidad] = useState<number>(5)
  const [texasTaxPercent, setTexasTaxPercent] = useState<number>(0) // 0 = Exempt, 8.25 = Texas Tax
  const [fleteNacionalUSD, setFleteNacionalUSD] = useState<number>(15.0)
  const [arancelImportacionPercent, setArancelImportacionPercent] = useState<number>(5.0) // 5% aduana/flete int.
  const [tipoCambio, setTipoCambio] = useState<number>(20.5)

  // Cálculos dinámicos
  const subtotalNetoUSD = precioBaseUSD * cantidad
  const taxMontoUSD = subtotalNetoUSD * (texasTaxPercent / 100)
  const costoTotalBaseConTax = subtotalNetoUSD + taxMontoUSD + fleteNacionalUSD
  const costoImportacionMontoUSD = costoTotalBaseConTax * (arancelImportacionPercent / 100)
  const landedTotalUSD = costoTotalBaseConTax + costoImportacionMontoUSD
  const landedUnitarioUSD = cantidad > 0 ? landedTotalUSD / cantidad : 0
  const landedUnitarioMXN = landedUnitarioUSD * tipoCambio
  const landedTotalMXN = landedTotalUSD * tipoCambio
  const incrementoFactor = precioBaseUSD > 0 ? ((landedUnitarioUSD - precioBaseUSD) / precioBaseUSD) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-slate-200 text-slate-900 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                Calculadora de Landed Price (USA → Taller MX)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Calcula el costo real puesto en taller incluyendo impuestos de EE. UU. (Texas Tax), flete a bodega y arancel de importación.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          {/* Formulario de Entrada */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#0369A1]" /> Parámetros de Compra
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Precio Unitario USD</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioBaseUSD}
                    onChange={(e) => setPrecioBaseUSD(parseFloat(e.target.value) || 0)}
                    className="pl-6 text-sm font-bold border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cantidad (pzas)</Label>
                <Input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                  className="text-sm font-bold border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">US Sales Tax (Texas)</Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTexasTaxPercent(0)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      texasTaxPercent === 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Exento (0%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTexasTaxPercent(8.25)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      texasTaxPercent === 8.25
                        ? 'bg-[#0369A1] text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    Texas (8.25%)
                  </button>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={texasTaxPercent}
                onChange={(e) => setTexasTaxPercent(parseFloat(e.target.value) || 0)}
                className="text-sm border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Flete US → Bodega (USD)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={fleteNacionalUSD}
                  onChange={(e) => setFleteNacionalUSD(parseFloat(e.target.value) || 0)}
                  className="text-sm border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Importación / Aduana %</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={arancelImportacionPercent}
                  onChange={(e) => setArancelImportacionPercent(parseFloat(e.target.value) || 0)}
                  className="text-sm border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tipo Cambio USD/MXN</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(parseFloat(e.target.value) || 20.5)}
                className="text-sm font-bold border-slate-200"
              />
            </div>
          </div>

          {/* Desglose y Resultados Light */}
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 flex flex-col justify-between shadow-2xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Desglose Landed Cost
                </span>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px] font-bold">
                  +{incrementoFactor.toFixed(1)}% vs Factura USA
                </Badge>
              </div>

              <div className="space-y-2 text-xs border-b border-slate-200 pb-3 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal Factura Proveedor:</span>
                  <span className="font-mono font-bold text-slate-900">${subtotalNetoUSD.toFixed(2)} USD</span>
                </div>
                {texasTaxPercent > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Texas Sales Tax ({texasTaxPercent}%):</span>
                    <span className="font-mono font-bold">+${taxMontoUSD.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Flete US a Laredo/McAllen:</span>
                  <span className="font-mono font-bold text-slate-900">+${fleteNacionalUSD.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-sky-700">
                  <span>Gastos Aduanales / Importación ({arancelImportacionPercent}%):</span>
                  <span className="font-mono font-bold">+${costoImportacionMontoUSD.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Resultado Destacado Unitario */}
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">
                  Costo Real Landed por Pieza
                </div>
                <div className="text-2xl font-black text-emerald-700 flex items-baseline gap-2">
                  ${landedUnitarioUSD.toFixed(2)} USD
                  <span className="text-sm font-semibold text-slate-600">
                    (${(landedUnitarioMXN).toFixed(2)} MXN)
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  (Precio factura era ${precioBaseUSD.toFixed(2)} USD)
                </div>
              </div>
            </div>

            {/* Total Inversión Lote */}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">Inversión Total Lote ({cantidad} pz):</span>
              <div className="text-right">
                <div className="font-extrabold text-slate-900 text-base">${landedTotalUSD.toFixed(2)} USD</div>
                <div className="text-[10px] text-slate-500 font-medium">${landedTotalMXN.toFixed(2)} MXN</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
