/** Lista blanca del equipo SMV. Mantener sincronizada con `firestore.rules`. */
export const CORREOS_AUTORIZADOS = [
  "ordenes@smv.com",
  "lorena@smv.com",
  "jemiliano2001@gmail.com",
  "diseno@smv.com",
  "almacen@smv.com",
] as const

function parseCorreosExtra(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter(Boolean)
}

function correosDesdeEnv(): string[] {
  const extras = [
    ...parseCorreosExtra(process.env.AUTHORIZED_EMAILS_EXTRA),
    ...parseCorreosExtra(process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS_EXTRA),
  ]
  return extras
}

export function conjuntoCorreosAutorizados(): Set<string> {
  const base = CORREOS_AUTORIZADOS.map((correo) => correo.toLowerCase())
  return new Set([...base, ...correosDesdeEnv()])
}

export function esCorreoAutorizado(email: string | null | undefined): boolean {
  if (!email) return false
  return conjuntoCorreosAutorizados().has(email.trim().toLowerCase())
}
