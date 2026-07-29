'use client'

import { Filter, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  CASE_TYPE_LABELS,
  WORKFLOW_STATE_LABELS,
  type IntegrityCaseType,
  type IntegrityWorkflowState,
} from "@/lib/reportes-integridad"

export type FilterSelection = {
  state: IntegrityWorkflowState | "all"
  severity: "alta" | "media" | "all"
  type: IntegrityCaseType | "all"
  currency: string | "all"
}

const DEFAULT_FILTERS: FilterSelection = {
  state: "all",
  severity: "all",
  type: "all",
  currency: "all",
}

export function activeFilterCount(filters: FilterSelection): number {
  return Object.values(filters).filter((value) => value !== "all").length
}

function Controls({
  filters,
  currencies,
  onChange,
  stacked = false,
}: {
  filters: FilterSelection
  currencies: string[]
  onChange: (filters: FilterSelection) => void
  stacked?: boolean
}) {
  const controlClass = stacked ? "w-full" : "min-w-44"
  return (
    <div className={stacked ? "grid gap-4" : "flex flex-wrap items-end gap-3"}>
      <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${controlClass}`}>
        Estado
        <Select
          value={filters.state}
          onValueChange={(state) =>
            onChange({ ...filters, state: state as FilterSelection["state"] })
          }
        >
          <SelectTrigger className="h-11 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Casos abiertos</SelectItem>
            {Object.entries(WORKFLOW_STATE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${controlClass}`}>
        Severidad
        <Select
          value={filters.severity}
          onValueChange={(severity) =>
            onChange({
              ...filters,
              severity: severity as FilterSelection["severity"],
            })
          }
        >
          <SelectTrigger className="h-11 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alta y media</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${controlClass}`}>
        Tipo
        <Select
          value={filters.type}
          onValueChange={(type) =>
            onChange({ ...filters, type: type as FilterSelection["type"] })
          }
        >
          <SelectTrigger className="h-11 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${controlClass}`}>
        Moneda
        <Select
          value={filters.currency}
          onValueChange={(currency) => onChange({ ...filters, currency })}
        >
          <SelectTrigger className="h-11 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las monedas</SelectItem>
            {currencies.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  )
}

export default function IntegrityFilters({
  filters,
  currencies,
  onChange,
}: {
  filters: FilterSelection
  currencies: string[]
  onChange: (filters: FilterSelection) => void
}) {
  const count = activeFilterCount(filters)
  const chips = [
    filters.state !== "all"
      ? {
          key: "state" as const,
          label: WORKFLOW_STATE_LABELS[filters.state],
        }
      : null,
    filters.severity !== "all"
      ? { key: "severity" as const, label: `Severidad ${filters.severity}` }
      : null,
    filters.type !== "all"
      ? { key: "type" as const, label: CASE_TYPE_LABELS[filters.type] }
      : null,
    filters.currency !== "all"
      ? { key: "currency" as const, label: filters.currency }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null)

  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-4" aria-label="Filtros de Integridad">
      <div className="hidden md:block">
        <Controls filters={filters} currencies={currencies} onChange={onChange} />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="min-h-11 w-full justify-center">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtros ({count})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:duration-0">
            <SheetHeader>
              <SheetTitle>Filtrar casos</SheetTitle>
              <SheetDescription>
                La prioridad siempre conserva el orden canónico.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <Controls
                filters={filters}
                currencies={currencies}
                onChange={onChange}
                stacked
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="min-h-8 gap-1 px-2 text-sm">
              {chip.label}
              <button
                type="button"
                className="rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]"
                aria-label={`Quitar filtro ${chip.label}`}
                onClick={() => onChange({ ...filters, [chip.key]: "all" })}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            Limpiar
          </Button>
        </div>
      )}
    </section>
  )
}

export { DEFAULT_FILTERS }

