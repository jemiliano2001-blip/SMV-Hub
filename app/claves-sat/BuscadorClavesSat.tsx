'use client'

import { useEffect, useState } from "react"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { getClienteAuth } from "@/lib/firebase"

type SatSearchResponse = {
  query: string
  meta: {
    version: string
    updatedAtUtc: string | null
    total: number
  }
  results: Array<{
    entry: {
      clave: string
      descripcion: string
      tipo?: string | null
      division?: string | null
      grupo?: string | null
      clase?: string | null
      palabrasClave: string[]
    }
    score: number
    reasons: string[]
  }>
}

export default function BuscadorClavesSat() {
  const [query, setQuery] = useState("")
  const [data, setData] = useState<SatSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadResults() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set("q", query.trim())
        params.set("limit", "15")

        const token = await getClienteAuth().currentUser?.getIdToken()
        const response = await fetch(`/api/claves-sat?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (!response.ok) {
          throw new Error(`No se pudo consultar el catálogo (${response.status})`)
        }

        const payload = (await response.json()) as SatSearchResponse
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error desconocido al consultar el catálogo")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadResults()
    return () => {
      cancelled = true
    }
  }, [query])

  const formattedUpdatedAt = !data?.meta.updatedAtUtc
    ? "Pendiente de importar el archivo oficial"
    : new Date(data.meta.updatedAtUtc).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900">Buscador local de claves SAT</h2>
            <p className="mt-1 text-sm text-gray-500">
              Busca por descripción o por clave de 8 dígitos. La búsqueda se resuelve localmente dentro de la app.
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
            <div className="font-semibold">Catálogo cargado</div>
            <div>Total: {data?.meta.total ?? 0} claves</div>
            <div>Versión: {data?.meta.version ?? "pending-import"}</div>
            <div>Actualizado: {formattedUpdatedAt}</div>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium text-gray-700">Buscar producto o servicio</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. resorte de compresión, tornillo, 31161500"
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-9 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-400"
            />
          </div>
        </label>
      </section>

      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">No se pudo consultar el catálogo</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Resultados</h3>
            <p className="mt-1 text-xs text-gray-500">
              {query.trim()
                ? "Usa la clave elegida para llenar la columna Codigo en tu captura."
                : "Empieza escribiendo una descripción o una clave SAT."}
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
        </div>

        {data && data.meta.total === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-600">
            El catálogo local todavía está vacío. Ejecuta{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">npm run sat:import:phpcfdi</code>{' '}
            para cargar el catálogo oficial derivado del SAT.
          </div>
        ) : data && data.results.length === 0 ? (
          <div className="px-6 py-8 text-sm text-gray-600">
            {query.trim()
              ? "No hubo coincidencias para esa búsqueda. Prueba con menos palabras o con un término más general."
              : "Todavía no hay resultados porque la búsqueda está vacía."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data?.results.map(({ entry, reasons, score }) => (
              <article key={entry.clave} className="px-6 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-sm font-semibold text-blue-800">
                        {entry.clave}
                      </span>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        score {score}
                      </span>
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-gray-900">{entry.descripcion}</h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      {entry.division && <span>División: {entry.division}</span>}
                      {entry.grupo && <span>Grupo: {entry.grupo}</span>}
                      {entry.clase && <span>Clase: {entry.clase}</span>}
                    </div>
                  </div>
                  <div className="max-w-md rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    {reasons.join(" · ")}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
