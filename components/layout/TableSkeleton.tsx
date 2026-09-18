import { cn } from '@/lib/utils'

interface TableSkeletonProps {
  columns?: number
  rows?: number
  showFilters?: boolean
  className?: string
}

const WIDTH_PATTERNS = ['w-3/4', 'w-1/2', 'w-4/5', 'w-2/3', 'w-3/5', 'w-1/3']

/**
 * Esqueleto tabular de alta fidelidad que previene Cumulative Layout Shift (CLS).
 * Reserva la geometría exacta de las tablas de datos mientras los datos cargan.
 */
export default function TableSkeleton({
  columns = 6,
  rows = 5,
  showFilters = false,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 py-1">
          <div className="h-9 w-64 rounded-md bg-muted/60 animate-pulse" />
          <div className="h-9 w-32 rounded-md bg-muted/60 animate-pulse" />
          <div className="h-9 w-28 rounded-md bg-muted/60 animate-pulse" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Cabecera simulada */}
        <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={`th-${i}`}
              className={cn(
                'h-3.5 rounded bg-muted animate-pulse',
                WIDTH_PATTERNS[i % WIDTH_PATTERNS.length]
              )}
            />
          ))}
        </div>

        {/* Filas de datos simuladas */}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
              key={`tr-${rowIdx}`}
              className="flex items-center gap-4 px-4 py-3.5 transition-colors"
            >
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div
                  key={`td-${rowIdx}-${colIdx}`}
                  className={cn(
                    'h-4 rounded bg-muted/70 animate-pulse',
                    WIDTH_PATTERNS[(colIdx + rowIdx) % WIDTH_PATTERNS.length]
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
