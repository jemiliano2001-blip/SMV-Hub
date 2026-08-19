import { Hash } from 'lucide-react'

import AuthGuard from '../AuthGuard'
import BuscadorClavesSat from './BuscadorClavesSat'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'

export default function ClavesSatPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Claves SAT"
          badge="c_ClaveProdServ"
          icon={Hash}
          description="Consulta el catálogo local y usa la clave correcta al capturar tus compras."
        />
        <BuscadorClavesSat />
      </PageShell>
    </AuthGuard>
  )
}
