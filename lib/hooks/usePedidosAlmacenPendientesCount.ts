import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Único hook del repo con listener en tiempo real (onSnapshot): a diferencia
// del resto de módulos (fetch-on-mount), el badge de pendientes solo cumple
// su propósito — recordarle al dueño sin que tenga que abrir la sección — si
// se actualiza solo. Se usa nada más para este contador, no para la lista.
export function usePedidosAlmacenPendientesCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const q = query(collection(db, 'pedidos-almacen'), where('estado', '==', 'pendiente'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => console.error('Error escuchando pedidos de almacén pendientes:', err)
    )
    return () => unsubscribe()
  }, [])

  return count
}
