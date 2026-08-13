import AuthGuard from "@/app/AuthGuard"
import GafetesView from "./GafetesView"

export default function GafetesPage() {
  return (
    <AuthGuard>
      <GafetesView />
    </AuthGuard>
  )
}
