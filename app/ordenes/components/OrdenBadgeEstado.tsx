import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export default function OrdenBadgeEstado({ estado }: { estado: string }) {
  switch (estado) {
    case 'aprobada':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-600/20 ring-inset">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aprobada
        </span>
      )
    case 'rechazada':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-600/20 ring-inset">
          <XCircle className="h-3.5 w-3.5" />
          Rechazada
        </span>
      )
    case 'pendiente':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-yellow-600/20 ring-inset">
          <Clock className="h-3.5 w-3.5" />
          Pendiente
        </span>
      )
  }
}
