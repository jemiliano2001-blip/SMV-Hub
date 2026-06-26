import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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
