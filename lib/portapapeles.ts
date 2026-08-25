import { toast } from "sonner"

/**
 * Copia texto al portapapeles y avisa **según el resultado real**.
 *
 * El patrón anterior (`void navigator.clipboard.writeText(x)` seguido de un
 * `toast.success` síncrono) mostraba "copiado" aunque la escritura fallara: la
 * promesa se descartaba con `void`, así que un permiso denegado o un contexto no
 * seguro (HTTP, iframe sin permiso) daba un mensaje de éxito falso y el usuario
 * pegaba contenido viejo sin enterarse.
 */
export async function copiarAlPortapapeles(
  texto: string,
  mensajeExito: string,
  descripcion?: string | null
): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("El navegador no expone el portapapeles")
    }
    await navigator.clipboard.writeText(texto)
    toast.success(mensajeExito, descripcion ? { description: descripcion } : undefined)
    return true
  } catch (err) {
    console.error("Error copiando al portapapeles:", err)
    toast.error("No se pudo copiar", {
      description: "Revisa los permisos del navegador e inténtalo de nuevo.",
    })
    return false
  }
}
