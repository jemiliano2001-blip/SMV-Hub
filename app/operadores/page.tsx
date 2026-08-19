import { Users } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import OperadoresList from './OperadoresList'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function OperadoresPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Catálogo de operadores"
          badge="Personal maestro"
          icon={Users}
          description="Lista maestra de operadores del taller para autocompletado en existencias y horas extra."
        />
        <OperadoresList />
      </PageShell>
    </AuthGuard>
  )
}
