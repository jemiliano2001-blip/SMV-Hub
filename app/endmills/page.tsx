import AuthGuard from "@/app/AuthGuard"
import EndmillsView from "@/app/endmills/EndmillsView"

export default function EndmillsPage() {
  return (
    <AuthGuard>
      <EndmillsView />
    </AuthGuard>
  )
}
