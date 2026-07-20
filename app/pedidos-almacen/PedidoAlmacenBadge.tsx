'use client'

import { usePedidosAlmacenPendientesCount } from '@/lib/hooks/usePedidosAlmacenPendientesCount'

export default function PedidoAlmacenBadge({ className = '' }: { className?: string }) {
  const count = usePedidosAlmacenPendientesCount()
  if (count === 0) return null

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none ${className}`}
    >
      {count}
    </span>
  )
}
