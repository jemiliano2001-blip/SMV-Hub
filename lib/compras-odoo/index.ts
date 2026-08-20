export {
  CATEGORIAS_PRODUCTO_REGISTRO,
  FAMILIAS_CON_RANGO,
  resolverCategoriaProducto,
  detectarTipoInsumo,
  obtenerCategoriaDef,
  type CategoriaProductoDef,
  type ResolverCategoriaInput,
} from "./categorias-registro"

export { parseAtributosMetal, type AtributosMetal } from "./parse-metal"

export {
  generarLlaveItem,
  normalizarTextoLlave,
  type LlaveItemInput,
} from "./llave-item"

export {
  construirItemDesdeLinea,
  type CompraOdooItemNormalizado,
  type LineaCompraInput,
  type FuenteCompraOdoo,
} from "./construir-item"

export {
  consolidarHistoricoCostos,
  type HistoricoCostoPorItem,
  type PuntoCostoHistorico,
} from "./consolidar"

export {
  rangoPreciosPorFamilia,
  rangoPreciosPorMetal,
  listarTiposEnCategoria,
  listarTiposMetal,
  listarMedidasEnCategoria,
  listarMedidasParaMetal,
  tipoEfectivoItem,
  esItemComprable,
  type FiltroRangoFamilia,
  type FiltroRangoMetal,
  type RangoPreciosFamilia,
  type RangoPreciosMetal,
} from "./rangos"

export {
  claveHibridaItem,
  comprasHistoricasDelGrupo,
  grupoConMasCompras,
  indiceRangosHistoricos,
  llaveRangoHistorico,
  monedaItem,
  nivelClaveHibrida,
  posicionPrecioEnRango,
  rangoHistoricoPorClave,
  TOLERANCIA_PRECIO_BARATO,
  type ItemParaClaveHibrida,
  type NivelClaveHibrida,
  type PosicionPrecioRango,
  type RangoHistoricoClave,
} from "./clave-hibrida"

export { idsHuerfanosCompras } from "./huerfanos"
