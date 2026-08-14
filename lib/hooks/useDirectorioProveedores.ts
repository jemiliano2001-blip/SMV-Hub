import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  actualizarProveedor,
  crearProveedor,
  eliminarProveedor,
  type NuevoProveedorPayload,
} from "@/lib/proveedores"
import {
  filtrarOrdenarDirectorio,
  requiereCatalogoCompleto,
  type CategoriaFiltroProveedor,
  type MercadoProveedor,
  type OrdenamientoProveedor,
} from "@/lib/proveedores/directorio"
import {
  obtenerCatalogoCompletoProveedores,
  obtenerPaginaProveedores,
  obtenerResumenProveedores,
  obtenerTodosProveedoresMercado,
  type CursorProveedor,
  type ResumenProveedores,
} from "@/lib/proveedores/repositorio"
import type { Proveedor } from "@/lib/schemas"

const RESUMEN_VACIO: ResumenProveedores = { usa: 0, mexico: 0, total: 0, sinMercado: 0 }

export interface OpcionesDirectorioProveedores {
  mercado: MercadoProveedor
  tamanoPagina?: number
}

export function useDirectorioProveedores({
  mercado,
  tamanoPagina = 18,
}: OpcionesDirectorioProveedores) {
  const [proveedoresBase, setProveedoresBase] = useState<Proveedor[]>([])
  const [cursor, setCursor] = useState<CursorProveedor | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [regionCompleta, setRegionCompleta] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenProveedores>(RESUMEN_VACIO)
  const [catalogoCompleto, setCatalogoCompleto] = useState<Proveedor[] | null>(null)
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaFiltroProveedor>("todas")
  const [orden, setOrden] = useState<OrdenamientoProveedor>(
    mercado === "mexico" ? "habitual" : "nombre",
  )
  const solicitudActual = useRef(0)
  const promesaCatalogo = useRef<Promise<Proveedor[]> | null>(null)

  const refrescarResumen = useCallback(async () => {
    try {
      setResumen(await obtenerResumenProveedores())
    } catch (err) {
      console.error("No se pudo cargar el resumen de proveedores:", err)
    }
  }, [])

  const cargarPrimeraPagina = useCallback(async () => {
    const solicitud = ++solicitudActual.current
    setCargando(true)
    setError(null)
    setRegionCompleta(false)
    try {
      if (mercado === "mexico") {
        const lista = await obtenerTodosProveedoresMercado(mercado)
        if (solicitud !== solicitudActual.current) return
        setProveedoresBase(lista)
        setCursor(null)
        setHayMas(false)
        setRegionCompleta(true)
        return
      }
      const pagina = await obtenerPaginaProveedores({ mercado, tamano: tamanoPagina })
      if (solicitud !== solicitudActual.current) return
      setProveedoresBase(pagina.items)
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      if (solicitud !== solicitudActual.current) return
      console.error("Error al cargar el directorio de proveedores:", err)
      setError("No se pudieron cargar los proveedores.")
      setProveedoresBase([])
      setCursor(null)
      setHayMas(false)
    } finally {
      if (solicitud === solicitudActual.current) setCargando(false)
    }
  }, [mercado, tamanoPagina])

  useEffect(() => {
    // Las funciones actualizan estado después de resolver consultas externas de Firestore.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarPrimeraPagina()
    void refrescarResumen()
  }, [cargarPrimeraPagina, refrescarResumen])

  useEffect(() => {
    // Al cambiar USA/MX el orden default es distinto; no conservar sort del otro mercado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrden(mercado === "mexico" ? "habitual" : "nombre")
  }, [mercado])

  const cargarMas = useCallback(async () => {
    if (!cursor || !hayMas || cargandoMas || cargando) return
    setCargandoMas(true)
    setError(null)
    try {
      const pagina = await obtenerPaginaProveedores({
        mercado,
        tamano: tamanoPagina,
        cursor,
      })
      setProveedoresBase((actuales) => {
        const ids = new Set(actuales.map((proveedor) => proveedor.id))
        return [...actuales, ...pagina.items.filter((proveedor) => !ids.has(proveedor.id))]
      })
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error("Error al cargar más proveedores:", err)
      setError("No se pudo cargar la siguiente página de proveedores.")
    } finally {
      setCargandoMas(false)
    }
  }, [cargando, cargandoMas, cursor, hayMas, mercado, tamanoPagina])

  const filtros = useMemo(
    () => ({ busqueda, categoria: filtroCategoria, orden }),
    [busqueda, filtroCategoria, orden]
  )

  const cargarRegionCompleta = useCallback(async () => {
    if (regionCompleta) return proveedoresBase
    const solicitud = ++solicitudActual.current
    setCargando(true)
    setError(null)
    try {
      const lista = await obtenerTodosProveedoresMercado(mercado)
      if (solicitud !== solicitudActual.current) return lista
      setProveedoresBase(lista)
      setCursor(null)
      setHayMas(false)
      setRegionCompleta(true)
      return lista
    } catch (err) {
      if (solicitud === solicitudActual.current) {
        console.error("Error al completar el catálogo del mercado:", err)
        setError("No se pudo completar el catálogo para aplicar los filtros.")
      }
      throw err
    } finally {
      if (solicitud === solicitudActual.current) setCargando(false)
    }
  }, [mercado, proveedoresBase, regionCompleta])

  useEffect(() => {
    if (!requiereCatalogoCompleto(filtros) || regionCompleta) return
    const temporizador = window.setTimeout(() => {
      void cargarRegionCompleta()
    }, busqueda.trim() ? 250 : 0)
    return () => window.clearTimeout(temporizador)
  }, [busqueda, cargarRegionCompleta, filtros, regionCompleta])

  const proveedores = useMemo(
    () => filtrarOrdenarDirectorio(proveedoresBase, filtros),
    [filtros, proveedoresBase]
  )

  const cargarCatalogoCompleto = useCallback(async (): Promise<Proveedor[]> => {
    if (catalogoCompleto) return catalogoCompleto
    if (promesaCatalogo.current) return promesaCatalogo.current
    setCargandoCatalogo(true)
    const promesa = obtenerCatalogoCompletoProveedores()
      .then((lista) => {
        setCatalogoCompleto(lista)
        return lista
      })
      .finally(() => {
        promesaCatalogo.current = null
        setCargandoCatalogo(false)
      })
    promesaCatalogo.current = promesa
    return promesa
  }, [catalogoCompleto])

  const invalidarYRecargar = useCallback(async () => {
    setCatalogoCompleto(null)
    promesaCatalogo.current = null
    await Promise.all([cargarPrimeraPagina(), refrescarResumen()])
  }, [cargarPrimeraPagina, refrescarResumen])

  const handleCrear = useCallback(async (payload: NuevoProveedorPayload) => {
    const nuevo = await crearProveedor(payload)
    await invalidarYRecargar()
    return nuevo
  }, [invalidarYRecargar])

  const handleEditar = useCallback(async (id: string, cambios: Partial<NuevoProveedorPayload>) => {
    await actualizarProveedor(id, cambios)
    await invalidarYRecargar()
  }, [invalidarYRecargar])

  const handleEliminar = useCallback(async (id: string) => {
    await eliminarProveedor(id)
    await invalidarYRecargar()
  }, [invalidarYRecargar])

  return {
    proveedores,
    catalogoCompleto,
    cargando,
    cargandoMas,
    cargandoCatalogo,
    error,
    hayMas,
    regionCompleta,
    resumen,
    busqueda,
    setBusqueda,
    filtroCategoria,
    setFiltroCategoria,
    orden,
    setOrden,
    cargarMas,
    cargarCatalogoCompleto,
    recargar: cargarPrimeraPagina,
    crearProveedor: handleCrear,
    editarProveedor: handleEditar,
    eliminarProveedor: handleEliminar,
  }
}
