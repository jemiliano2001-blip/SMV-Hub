/**
 * Correo con acceso admin garantizado, fijo en código como red de seguridad:
 * si el documento de Firestore correspondiente en `usuarios` se borra o se
 * corrompe, este correo nunca pierde acceso a /usuarios. Todos los demás
 * roles y correos autorizados viven en Firestore, administrados desde la
 * pantalla /usuarios.
 */
export const CORREO_ADMIN_BREAK_GLASS = "jemiliano2001@gmail.com"

export function esCorreoBreakGlass(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === CORREO_ADMIN_BREAK_GLASS
}
