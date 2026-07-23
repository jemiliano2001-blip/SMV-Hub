import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-[#F8FAFC] px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-sky-50 p-3 text-[#0369A1]">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-slate-950">Esta página no existe</h1>
        <p className="mt-2 text-sm text-slate-600">
          La dirección pudo cambiar o el módulo fue retirado.
        </p>
        <Button asChild className="mt-6 min-h-10 bg-[#0369A1] hover:bg-[#075985]">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  )
}

