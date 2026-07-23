import { useState, useEffect, useMemo, useCallback } from "react"
import {
  obtenerProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  type NuevoProveedorPayload,
} from "@/lib/proveedores"
import type { Proveedor, CategoriaProveedor, EstatusProveedor, TipoProveedor } from "@/lib/schemas"
import type { OrdenamientoProveedor } from "@/lib/proveedores/directorio"

export type { OrdenamientoProveedor } from "@/lib/proveedores/directorio"

export function useProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusProveedor | "todos">("todos")
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaProveedor | "todas">("todas")
  const [filtroTipo, setFiltroTipo] = useState<TipoProveedor | "todos">("todos")
  const [soloBaratos, setSoloBaratos] = useState(false)
  const [soloRecomendados, setSoloRecomendados] = useState(false)
  const [orden, setOrden] = useState<OrdenamientoProveedor>("calificacion")

  const cargarData = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const data = await obtenerProveedores()
      setProveedores(data)
    } catch (err) {
      console.error("Error al cargar proveedores:", err)
      setError("No se pudieron cargar los proveedores.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // Carga inicial: falso positivo (en montaje cargando ya es true, sin cascada).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarData()
  }, [cargarData])

  // Filtrado y Ordenamiento Multicriterio
  const proveedoresFiltrados = useMemo(() => {
    const list = proveedores.filter((p) => {
      // 1. Estatus
      if (filtroEstatus !== "todos" && p.estatus !== filtroEstatus) return false

      // 2. Tipo (barato, estandar, premium)
      if (filtroTipo !== "todos" && p.tipoProveedor !== filtroTipo) return false

      // 3. Solo baratos
      if (soloBaratos && !p.barato) return false

      // 4. Solo recomendados
      if (soloRecomendados && !p.recomendado) return false

      // 5. Categoría
      if (filtroCategoria !== "todas" && !p.categorias.includes(filtroCategoria)) return false

      // 6. Texto libre (nombre, marcas, contacto, email, broker, shipping, notas, ubicación)
      const q = busqueda.trim().toLowerCase()
      if (!q) return true

      const enNombre = p.nombre.toLowerCase().includes(q)
      const enContacto = p.contacto?.toLowerCase().includes(q) ?? false
      const enEmail = p.email?.toLowerCase().includes(q) ?? false
      const enBroker = p.brokerAduanal?.toLowerCase().includes(q) ?? false
      const enShipping = p.shippingAddressUSA?.toLowerCase().includes(q) ?? false
      const enNotas = p.notas?.toLowerCase().includes(q) ?? false
      const enExp = p.experienciaCompra?.toLowerCase().includes(q) ?? false
      const enUbicacion = p.ubicacion?.toLowerCase().includes(q) ?? false
      const enMarcas = p.marcas.some((m) => m.toLowerCase().includes(q))

      return (
        enNombre ||
        enContacto ||
        enEmail ||
        enBroker ||
        enShipping ||
        enNotas ||
        enExp ||
        enUbicacion ||
        enMarcas
      )
    })

    // Ordenamiento
    return list.sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre)

      if (orden === "calificacion") {
        return (b.calificacion ?? 0) - (a.calificacion ?? 0)
      }

      if (orden === "leadTime") {
        const ltA = a.leadTimeDias ?? 999
        const ltB = b.leadTimeDias ?? 999
        return ltA - ltB
      }

      if (orden === "barato") {
        if (a.barato === b.barato) return a.nombre.localeCompare(b.nombre)
        return a.barato ? -1 : 1
      }

      if (orden === "prioridad") {
        const peso = { alta: 3, media: 2, baja: 1 }
        return peso[b.prioridad] - peso[a.prioridad]
      }

      return 0
    })
  }, [proveedores, busqueda, filtroEstatus, filtroCategoria, filtroTipo, soloBaratos, soloRecomendados, orden])

  async function handleCrear(payload: NuevoProveedorPayload) {
    try {
      const nuevo = await crearProveedor(payload)
      setProveedores((prev) => [...prev, nuevo])
      return nuevo
    } catch (err) {
      console.error("Error al crear proveedor:", err)
      throw new Error("No se pudo guardar el proveedor")
    }
  }

  async function handleEditar(id: string, cambios: Partial<NuevoProveedorPayload>) {
    try {
      await actualizarProveedor(id, cambios)
      setProveedores((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...cambios, actualizadoEn: new Date().toISOString() } : p))
      )
    } catch (err) {
      console.error("Error al actualizar proveedor:", err)
      throw new Error("No se pudo actualizar el proveedor")
    }
  }

  async function handleEliminar(id: string) {
    try {
      await eliminarProveedor(id)
      setProveedores((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error("Error al eliminar proveedor:", err)
      throw new Error("No se pudo eliminar el proveedor")
    }
  }

  return {
    proveedores: proveedoresFiltrados,
    todosProveedores: proveedores,
    cargando,
    error,
    busqueda,
    setBusqueda,
    filtroEstatus,
    setFiltroEstatus,
    filtroCategoria,
    setFiltroCategoria,
    filtroTipo,
    setFiltroTipo,
    soloBaratos,
    setSoloBaratos,
    soloRecomendados,
    setSoloRecomendados,
    orden,
    setOrden,
    recargar: cargarData,
    crearProveedor: handleCrear,
    editarProveedor: handleEditar,
    eliminarProveedor: handleEliminar,
  }
}
