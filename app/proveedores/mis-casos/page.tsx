import AuthGuard from "@/app/AuthGuard"
import MisCasosView from "./MisCasosView"

export default function MisCasosPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <MisCasosView />
      </div>
    </AuthGuard>
  )
}

