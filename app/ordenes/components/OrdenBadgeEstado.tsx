import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function OrdenBadgeEstado({ estado }: { estado: string }) {
  switch (estado) {
    case 'aprobada':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-300 font-mono text-[10px] font-bold uppercase gap-1 shadow-2xs">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Aprobada
        </Badge>
      )
    case 'rechazada':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-900 border-red-300 font-mono text-[10px] font-bold uppercase gap-1 shadow-2xs">
          <XCircle className="h-3 w-3 text-red-600" />
          Rechazada
        </Badge>
      )
    case 'pendiente':
    default:
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 font-mono text-[10px] font-bold uppercase gap-1 shadow-2xs">
          <Clock className="h-3 w-3 text-amber-600" />
          Pendiente
        </Badge>
      )
  }
}
