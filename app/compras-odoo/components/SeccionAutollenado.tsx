'use client'

import { CheckCheck, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { OrdenTrabajoSugerida } from './tipos-captura'

const PRESETS_USO = ['Stock', 'Mantenimiento', 'Taller', 'Herramientas'] as const

export interface SeccionAutollenadoProps {
  defaultRequisitor: string
  defaultEmpresa: string
  defaultUso: string
  defaultOrdenTrabajoId: number | null
  defaultUdm: string
  defaultTasaIva: number
  busquedaOtCabecera: string
  mostrarDropdownOt: boolean
  ordenesTrabajo: OrdenTrabajoSugerida[]
  cargandoOTs: boolean
  cantidadPartidas?: number
  onRequisitorChange: (v: string) => void
  onEmpresaChange: (v: string) => void
  onUdmChange: (v: string) => void
  onTasaIvaChange: (tasa: number, impuesto: string) => void
  onBusquedaOtChange: (v: string) => void
  onMostrarDropdownOt: (v: boolean) => void
  onSeleccionarOt: (ot: OrdenTrabajoSugerida) => void
  onSeleccionarPreset: (opt: string) => void
  onAplicarATodas?: () => void
}

export default function SeccionAutollenado({
  defaultRequisitor,
  defaultEmpresa,
  defaultUso,
  defaultOrdenTrabajoId,
  defaultUdm,
  defaultTasaIva,
  busquedaOtCabecera,
  mostrarDropdownOt,
  ordenesTrabajo,
  cargandoOTs,
  cantidadPartidas = 0,
  onRequisitorChange,
  onEmpresaChange,
  onUdmChange,
  onTasaIvaChange,
  onBusquedaOtChange,
  onMostrarDropdownOt,
  onSeleccionarOt,
  onSeleccionarPreset,
  onAplicarATodas,
}: SeccionAutollenadoProps) {
  return (
    <Card className="bg-card/70 backdrop-blur-md border-border/80 gap-4 py-4 shadow-sm lg:col-span-5">
      <CardHeader className="border-b px-4 pb-3 [.border-b]:pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="text-amber-500" aria-hidden />
            2. Autollenado de Partidas
          </CardTitle>
          <span className="text-muted-foreground text-[10px] font-medium">Asignado por defecto</span>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <FieldGroup className="gap-2.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Field className="gap-0.5">
              <FieldLabel htmlFor="odoo-def-requisitor" className="text-[10px]">
                Requisitor
              </FieldLabel>
              <Input
                id="odoo-def-requisitor"
                value={defaultRequisitor}
                onChange={(e) => onRequisitorChange(e.target.value)}
                className="h-8 text-xs"
              />
            </Field>

            <Field className="gap-0.5">
              <FieldLabel htmlFor="odoo-def-empresa" className="text-[10px]">
                Empresa
              </FieldLabel>
              <Input
                id="odoo-def-empresa"
                value={defaultEmpresa}
                onChange={(e) => onEmpresaChange(e.target.value)}
                className="h-8 text-xs"
              />
            </Field>

            <Field className="relative gap-0.5">
              <div className="mb-0.5 flex items-center justify-between gap-1">
                <FieldLabel htmlFor="odoo-def-ot" className="text-[10px]">
                  OT / Uso
                </FieldLabel>
                {defaultOrdenTrabajoId != null && (
                  <Badge variant="secondary" className="font-mono text-[9px]">
                    OT #{defaultOrdenTrabajoId}
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Input
                  id="odoo-def-ot"
                  placeholder="ej. 2026/S01641 o Stock"
                  value={busquedaOtCabecera || defaultUso}
                  onFocus={() => onMostrarDropdownOt(true)}
                  onChange={(e) => onBusquedaOtChange(e.target.value)}
                  className="h-8 font-mono text-xs"
                  autoComplete="off"
                />
                {cargandoOTs && (
                  <span className="text-muted-foreground absolute top-1.5 right-2 font-mono text-[9px]">
                    ...
                  </span>
                )}
              </div>

              {mostrarDropdownOt && (
                <div
                  className="bg-popover absolute left-0 z-30 mt-1 max-h-52 w-72 overflow-y-auto rounded-lg border p-1 shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                    <span>Órdenes de Trabajo Odoo ({ordenesTrabajo.length})</span>
                    <button
                      type="button"
                      onClick={() => onMostrarDropdownOt(false)}
                      className="hover:text-foreground cursor-pointer px-1 text-xs font-bold"
                      aria-label="Cerrar lista de OT"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 border-b px-1 py-1">
                    {PRESETS_USO.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => onSeleccionarPreset(opt)}
                        className="bg-muted hover:bg-muted/80 text-foreground cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {ordenesTrabajo.length === 0 ? (
                    <div className="text-muted-foreground p-2 text-center text-xs">
                      {cargandoOTs ? 'Cargando órdenes...' : 'No se encontraron órdenes'}
                    </div>
                  ) : (
                    ordenesTrabajo.map((ot) => (
                      <button
                        key={ot.id}
                        type="button"
                        onClick={() => onSeleccionarOt(ot)}
                        className="hover:bg-accent hover:text-accent-foreground w-full cursor-pointer rounded border-b p-1.5 text-left text-xs last:border-0"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] font-bold">
                          <span>{ot.name}</span>
                          {ot.clientOrderRef && (
                            <span className="text-muted-foreground text-[10px] font-normal">
                              PO: {ot.clientOrderRef}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground truncate font-sans text-[10px]">
                          {ot.partnerName}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </Field>

            <Field className="gap-0.5">
              <FieldLabel htmlFor="odoo-def-udm" className="text-[10px]">
                UdM
              </FieldLabel>
              <Input
                id="odoo-def-udm"
                value={defaultUdm}
                onChange={(e) => onUdmChange(e.target.value)}
                className="h-8 text-xs"
              />
            </Field>

            <Field className="gap-0.5">
              <FieldLabel htmlFor="odoo-def-iva" className="text-[10px]">
                Impuesto
              </FieldLabel>
              <Select
                value={String(defaultTasaIva)}
                onValueChange={(v) => {
                  const tasa = parseFloat(v) || 0
                  const impuesto =
                    tasa === 0.16 ? 'IVA 16%' : tasa === 0.08 ? 'IVA 8%' : 'Tasa 0% / Exento'
                  onTasaIvaChange(tasa, impuesto)
                }}
              >
                <SelectTrigger id="odoo-def-iva" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="0.16">IVA 16%</SelectItem>
                    <SelectItem value="0.08">IVA 8% (Frontera)</SelectItem>
                    <SelectItem value="0">Tasa 0% (Importación)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {cantidadPartidas > 0 && onAplicarATodas && (
            <div className="mt-1 flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground text-[10px]">
                ¿Quieres reflejar estos valores en la tabla?
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAplicarATodas}
                className="h-7 cursor-pointer text-[10px] font-semibold"
              >
                <CheckCheck className="text-emerald-500" data-icon="inline-start" />
                Aplicar defaults a todas ({cantidadPartidas})
              </Button>
            </div>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
