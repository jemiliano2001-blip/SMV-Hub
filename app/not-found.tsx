import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="min-h-[70vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-sky-50 p-3 text-primary">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Esta página no existe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La dirección pudo cambiar o el módulo fue retirado.
        </p>
        <Button asChild className="mt-6 min-h-10 bg-primary hover:bg-primary/90">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  )
}

