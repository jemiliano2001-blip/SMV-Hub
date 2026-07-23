import { Skeleton } from "@/components/ui/skeleton"

export default function RouteLoading({
  title = "Cargando módulo",
  description = "Estamos preparando la información.",
}: {
  title?: string
  description?: string
}) {
  return (
    <main
      className="min-h-[70vh] bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52 bg-slate-200" />
          <Skeleton className="h-4 w-72 max-w-full bg-slate-200" />
          <span className="sr-only">{title}. {description}</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-10 flex-1 bg-slate-100" />
            <Skeleton className="h-10 w-full bg-slate-100 sm:w-40" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-14 w-full bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

