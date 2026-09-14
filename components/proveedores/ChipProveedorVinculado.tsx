'use client'

/**
 * Chip de vinculación de proveedor en captura (/nueva-compra, /cotizaciones).
 *
 * Toma el nombre libre que escribió el usuario o extrajo la IA y lo resuelve contra el catálogo
 * con `resolverProveedor` (nombre + alias). Tres estados:
 *   - exacto     → "Vinculado a X" (+ cambiar). El padre ya recibió el id por `onVincular`.
 *   - sugerido   → "¿Es X?" sí / no, es otro. "Sí" vincula y, si el usuario puede editar el
 *                  catálogo, guarda el nombre libre como alias (aprendizaje sin IA).
 *   - sin match  → "Proveedor nuevo" + dar de alta (mínimo: nombre, mercado, marketplace).
 * Nunca bloquea el guardado: si el catálogo no cargó o el usuario no tiene permisos, solo informa.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Link2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolverProveedor } from '@/lib/pieza-matching'
import {
  actualizarProveedor,
  aliasesConAprendizaje,
  crearProveedor,
  payloadProveedorMinimo,
} from '@/lib/proveedores'
import { esMarketplaceProbable } from '@/lib/proveedores-vinculacion-core'
import type { Proveedor } from '@/lib/schemas'

export interface ChipProveedorVinculadoProps {
  /** Nombre tal como está en el campo de proveedor. */
  nombreLibre: string
  catalogo: Proveedor[]
  /** Vínculo explícito elegido por el usuario (cambiar / sí / alta); null = derivar del nombre. */
  proveedorIdElegido: string | null
  /** El usuario eligió explícitamente (sí / otro / alta / quitar). El padre lo guarda y lo pasa de vuelta. */
  onElegir: (proveedorId: string | null) => void
  /** Se llama con el id efectivo cada vez que cambia (exacto automático o elección explícita). */
  onVincular: (proveedorId: string | null) => void
  /** Módulo `proveedores`: habilita aprender alias y dar de alta. */
  puedeEditarCatalogo: boolean
  /** Prellena el mercado del alta. */
  moneda?: 'USD' | 'MXN'
  /** Para que el padre refresque su catálogo tras un alta o un alias nuevo. */
  onCatalogoActualizado?: (proveedor: Proveedor) => void
  disabled?: boolean
}

type ModoChip = 'vinculado' | 'sugerido' | 'nuevo' | 'vacio'

export function ChipProveedorVinculado({
  nombreLibre,
  catalogo,
  proveedorIdElegido,
  onElegir,
  onVincular,
  puedeEditarCatalogo,
  moneda = 'USD',
  onCatalogoActualizado,
  disabled = false,
}: ChipProveedorVinculadoProps) {
  const nombre = nombreLibre.trim()
  const resolucion = useMemo(() => (nombre ? resolverProveedor(nombre, catalogo) : null), [nombre, catalogo])
  const elegido = useMemo(
    () => (proveedorIdElegido ? catalogo.find((p) => p.id === proveedorIdElegido) ?? null : null),
    [proveedorIdElegido, catalogo]
  )

  const [eligiendoOtro, setEligiendoOtro] = useState(false)
  const [dandoDeAlta, setDandoDeAlta] = useState(false)
  const [nombreAlta, setNombreAlta] = useState(nombre)
  const [mercadoAlta, setMercadoAlta] = useState<'usa' | 'mexico'>(moneda === 'MXN' ? 'mexico' : 'usa')
  const [marketplaceAlta, setMarketplaceAlta] = useState(esMarketplaceProbable(nombre))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Vínculo automático solo en exacto; cualquier otro caso deja el id en null hasta que el
  // usuario confirme. Se re-evalúa cuando cambia el nombre o llega el catálogo.
  const idEfectivo = elegido ? elegido.id : resolucion?.nivel === 'exacto' ? resolucion.proveedor.id : null
  useEffect(() => {
    onVincular(idEfectivo)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onVincular es estable en los padres (setState / setter memoizado)
  }, [idEfectivo])

  // Al cambiar el nombre se reinician los sub-estados del chip y la elección explícita: un
  // vínculo elegido para "Mouser" no vale para "DigiKey". En el montaje no: al editar un
  // registro que ya trae proveedorId, esa elección inicial debe respetarse.
  const nombreMontado = useRef(nombre)
  useEffect(() => {
    if (nombreMontado.current === nombre) return
    nombreMontado.current = nombre
    setEligiendoOtro(false)
    setDandoDeAlta(false)
    setNombreAlta(nombre)
    setMarketplaceAlta(esMarketplaceProbable(nombre))
    setError(null)
    onElegir(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onElegir es estable en los padres (setState)
  }, [nombre])

  const modo: ModoChip = !nombre
    ? 'vacio'
    : elegido || resolucion?.nivel === 'exacto'
      ? 'vinculado'
      : resolucion?.nivel === 'sugerido'
        ? 'sugerido'
        : 'nuevo'

  const vinculadoA = elegido ?? (resolucion?.nivel === 'exacto' ? resolucion.proveedor : null)

  async function confirmarSugerido() {
    if (!resolucion) return
    setError(null)
    onElegir(resolucion.proveedor.id)
    if (!puedeEditarCatalogo) return
    const aliases = aliasesConAprendizaje(resolucion.proveedor, nombre)
    if (!aliases) return
    setOcupado(true)
    try {
      await actualizarProveedor(resolucion.proveedor.id, { aliases })
      onCatalogoActualizado?.({ ...resolucion.proveedor, aliases })
    } catch (err) {
      // El vínculo ya quedó; aprender el alias es opcional y no debe estorbar la captura.
      console.error('[chip-proveedor] no se pudo guardar el alias:', err)
    } finally {
      setOcupado(false)
    }
  }

  async function darDeAlta() {
    const nombreFinal = nombreAlta.trim()
    if (!nombreFinal) {
      setError('Escribe el nombre del proveedor.')
      return
    }
    // Si al escribir el nombre final resulta que ya existe, vincula en vez de duplicar.
    const existente = resolverProveedor(nombreFinal, catalogo)
    if (existente?.nivel === 'exacto') {
      onElegir(existente.proveedor.id)
      setDandoDeAlta(false)
      return
    }
    setOcupado(true)
    setError(null)
    try {
      const aliases = nombreFinal.toLowerCase() !== nombre.toLowerCase() ? [nombre] : []
      const creado = await crearProveedor(
        payloadProveedorMinimo({ nombre: nombreFinal, mercado: mercadoAlta, esMarketplace: marketplaceAlta, aliases })
      )
      onCatalogoActualizado?.(creado)
      onElegir(creado.id)
      setDandoDeAlta(false)
    } catch (err) {
      console.error('[chip-proveedor] no se pudo dar de alta el proveedor:', err)
      setError('No se pudo dar de alta. Puedes guardar la compra sin vincular e intentarlo después.')
    } finally {
      setOcupado(false)
    }
  }

  if (modo === 'vacio') return null

  const base = 'mt-1.5 flex flex-wrap items-center gap-2 text-xs'

  if (eligiendoOtro) {
    return (
      <div className={base}>
        <span className="text-muted-foreground">Vincular a:</span>
        <select
          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
          defaultValue=""
          disabled={disabled || ocupado}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            onElegir(id)
            setEligiendoOtro(false)
          }}
        >
          <option value="">Elige un proveedor…</option>
          {catalogo.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {puedeEditarCatalogo && (
          <Button type="button" variant="ghost" size="xs" disabled={disabled || ocupado} onClick={() => { setEligiendoOtro(false); setDandoDeAlta(true) }}>
            <Plus /> Dar de alta nuevo
          </Button>
        )}
        <Button type="button" variant="ghost" size="xs" disabled={ocupado} onClick={() => setEligiendoOtro(false)}>
          Cancelar
        </Button>
      </div>
    )
  }

  if (dandoDeAlta) {
    return (
      <div className="mt-1.5 rounded-lg border border-border bg-muted/40 p-2.5 text-xs space-y-2">
        <p className="font-semibold text-foreground">Dar de alta proveedor</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="h-8 rounded-md border border-input bg-background px-2 text-xs sm:col-span-2"
            value={nombreAlta}
            onChange={(e) => setNombreAlta(e.target.value)}
            placeholder="Nombre en el catálogo"
            disabled={ocupado}
          />
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={mercadoAlta}
            onChange={(e) => setMercadoAlta(e.target.value === 'mexico' ? 'mexico' : 'usa')}
            disabled={ocupado}
          >
            <option value="usa">Mercado USA</option>
            <option value="mexico">Mercado México</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input"
            checked={marketplaceAlta}
            onChange={(e) => setMarketplaceAlta(e.target.checked)}
            disabled={ocupado}
          />
          Es un marketplace (eBay, Amazon…): canal de compra, no un vendedor identificado
        </label>
        {nombreAlta.trim() && nombreAlta.trim().toLowerCase() !== nombre.toLowerCase() && (
          <p className="text-muted-foreground">
            &quot;{nombre}&quot; quedará como alias para que la próxima vez vincule solo.
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" size="xs" disabled={ocupado} onClick={() => void darDeAlta()}>
            <Check /> {ocupado ? 'Guardando…' : 'Dar de alta y vincular'}
          </Button>
          <Button type="button" variant="ghost" size="xs" disabled={ocupado} onClick={() => setDandoDeAlta(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  if (modo === 'vinculado' && vinculadoA) {
    return (
      <div className={base}>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          <Link2 className="h-3 w-3" /> Vinculado a {vinculadoA.nombre}
          {vinculadoA.esMarketplace && <span className="text-primary/70">· marketplace</span>}
        </span>
        <Button type="button" variant="ghost" size="xs" disabled={disabled || ocupado} onClick={() => setEligiendoOtro(true)}>
          Cambiar
        </Button>
        {elegido && (
          <Button type="button" variant="ghost" size="xs" disabled={disabled || ocupado} onClick={() => onElegir(null)}>
            <X /> Quitar
          </Button>
        )}
      </div>
    )
  }

  if (modo === 'sugerido' && resolucion) {
    return (
      <div className={base}>
        <span className="text-muted-foreground">
          ¿Es <span className="font-semibold text-foreground">{resolucion.proveedor.nombre}</span>?
        </span>
        <Button type="button" size="xs" disabled={disabled || ocupado} onClick={() => void confirmarSugerido()}>
          <Check /> Sí
        </Button>
        <Button type="button" variant="outline" size="xs" disabled={disabled || ocupado} onClick={() => setEligiendoOtro(true)}>
          No, es otro
        </Button>
      </div>
    )
  }

  // modo === 'nuevo'
  return (
    <div className={base}>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" /> No está en el catálogo de proveedores
      </span>
      {puedeEditarCatalogo ? (
        <>
          <Button type="button" variant="outline" size="xs" disabled={disabled || ocupado} onClick={() => setDandoDeAlta(true)}>
            <Plus /> Dar de alta
          </Button>
          <Button type="button" variant="ghost" size="xs" disabled={disabled || ocupado} onClick={() => setEligiendoOtro(true)}>
            Vincular a uno existente
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground">— se guarda sin vincular; compras lo dará de alta.</span>
      )}
    </div>
  )
}
