import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage'
import { storage } from '@/lib/firebase'

export async function subirImagenOrden(file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const id = crypto.randomUUID()
  const path = `ordenes/${id}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, path }
}

export async function subirImagenPedidoAlmacen(file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const id = crypto.randomUUID()
  const path = `pedidos-almacen/${id}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, path }
}

export async function subirComprobanteCajaChica(file: File): Promise<{ url: string; path: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const id = crypto.randomUUID()
  const path = `caja-chica/${id}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, path }
}

/** Foto privada de un trabajador. El acceso queda restringido a super-admin en Storage Rules. */
export async function subirFotoGafete(operadorId: string, file: File): Promise<{ path: string }> {
  const ext = file.type === "image/png" ? "png" : "jpg"
  const path = `gafetes/${operadorId}/foto.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return { path }
}

/** Entrega una URL efímera tras pasar las Storage Rules del usuario actual. */
export async function cargarFotoGafete(path: string): Promise<string> {
  if (!path) return ""
  const blob = await getBlob(ref(storage, path))
  return URL.createObjectURL(blob)
}
