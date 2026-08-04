import { useMemo } from "react"
import { useRequisiciones } from "@/lib/hooks/useRequisiciones"
import { usePedidosAlmacen } from "@/lib/hooks/usePedidosAlmacen"
import { useCotizaciones } from "@/lib/hooks/useCotizaciones"
import { useProveedoresInteligencia } from "@/lib/hooks/useProveedoresInteligencia"
import { fusionarPuntosPrecio } from "@/lib/proveedores-inteligencia-cruzada"
import { evaluarSaludOperativa, type DiagnosticoOperativo } from "@/lib/radar/orquestador"

export function useRadarOperativo() {
  const { requisiciones, loading: cargandoReq } = useRequisiciones()
  const { pedidos, loading: cargandoPed } = usePedidosAlmacen()
  const { cotizaciones: historicoCotizaciones, loading: cargandoCot } = useCotizaciones()
  const { compras, cargando: cargandoInteligencia } = useProveedoresInteligencia()

  const cargando = Boolean(cargandoReq || cargandoPed || cargandoCot || cargandoInteligencia)

  const puntosPrecio = useMemo(() => {
    return fusionarPuntosPrecio(historicoCotizaciones, compras, [])
  }, [historicoCotizaciones, compras])

  const diagnostico: DiagnosticoOperativo = useMemo(() => {
    return evaluarSaludOperativa({
      requisiciones,
      pedidosAlmacen: pedidos,
      puntosPrecio,
    })
  }, [requisiciones, pedidos, puntosPrecio])

  return {
    diagnostico,
    cargando,
  }
}
