## Antes de usar este prompt

Revisé el repo de SMV Hub (Next.js 16 + Firebase, módulo `/almacen`) y encontré algo importante:

**El 2026-07-24 se retiró de `/almacen` una pestaña casi idéntica a lo que quieres construir ahora** ("Reabastecimiento ROP"). El motivo (commit `19e15f4`, hallazgo P1 de auditoría): el tablero corría sobre datos 100% inventados (`DEMO_ITEMS_RECOMPRA` — proveedores y cantidades ficticias), pero el botón "1-Click Requisición" sí escribía requisiciones **reales** en Firestore a partir de esos datos falsos. `CLAUDE.md` dice textualmente: *"No recrearlo sin datos reales de inventario."*

La lógica ROP/EOQ que tenía (`lib/recompra-herramientas.ts`, ya borrado pero recuperable con `git show 19e15f4^:lib/recompra-herramientas.ts`) es reutilizable — el problema nunca fue el cálculo, fue que no estaba conectado a inventario real. Por eso el prompt de abajo:

1. Exige leer ese commit antes de empezar, para no repetir el error.
2. Trae los **datos reales** de esta conversación en `endmills-seed.json` (adjunto), para que el agente no tenga que inventar nada.
3. Sigue el flujo de planeación obligatorio del propio repo (spec → plan → esperar tu confirmación) antes de tocar código de producción.

Copia todo el bloque de abajo en una sesión de Claude Code **dentro del repo de SMV Hub**, con `endmills-seed.json` en la raíz del proyecto.

---

## Prompt

Quiero agregar una sección nueva a SMV Hub para dar seguimiento a las 47 medidas de endmills que usamos, sus precios con nuestro proveedor en China (ChangZhou North Alloy Tool Co., contacto Rita) y cuánto pedir en cada ciclo de compra. Antes de escribir código:

**1. Lee el contexto obligatorio:**
- `PROJECT.md` y `CLAUDE.md` completos.
- `git show 19e15f4` — el commit que retiró la pestaña ROP de `/almacen` por correr sobre datos demo (`DEMO_ITEMS_RECOMPRA`) mientras escribía requisiciones reales. Lee también `lib/recompra-herramientas.ts` en esa versión (`git show 19e15f4^:lib/recompra-herramientas.ts`) — la fórmula ROP/EOQ ahí es reutilizable, el error fue la fuente de datos, no el cálculo.
- `docs/superpowers/plans/2026-07-24-lazo-retroalimentacion-produccion.md` y su spec — es el plan que acompañó ese retiro, dice qué faltaba para hacerlo bien.

**2. Sigue el flujo de planeación del repo** (sección "Flujo de planeación" en `CLAUDE.md`): primero un spec en `docs/superpowers/specs/YYYY-MM-DD-endmills-china-design.md`, luego un plan ejecutable en `docs/superpowers/plans/YYYY-MM-DD-endmills-china.md`. **Espera mi confirmación del plan antes de tocar código de producción o `firestore.rules`.**

**3. Datos reales — no inventes nada:**
`endmills-seed.json` (adjunto, en la raíz del repo) trae las 47 medidas reales con: categoría, medida en pulgadas, stock actual, precio actual USD, la orden de marzo 2026 completa (piezas pedidas, precio, subtotal) y la cotización de China de agosto 2026 (spec propuesta, precio, si requiere confirmación). También trae los totales reales de la orden de marzo (483 pzas, $6,159.94 USD con Ali Cost + shipping) y el dato del proveedor. Dos medidas (`id: 2` y `id: 38`) están marcadas `requiereConfirmacion: true` — sus specs/precios de China vinieron inconsistentes, no los trates como definitivos. Usa este JSON como semilla real vía script de import a Firestore — no generes ejemplos ficticios de otras categorías (insertos, tooling, etc.) siguiendo este patrón.

**4. Qué debe incluir la sección** (el flujo completo que ya armamos en Excel, ahora como feature real y viva en la app, no una foto de un momento):

- **Inventario de las 47 medidas** con stock actual, agrupado por categoría (Flat, Ball, Largo Flat, Largo Bola, Extra Largo Flat, Extra Largo Bola, Rupa/Carburo), con semáforo de color por nivel de stock (crítico/bajo/ok — puedes usar los mismos cortes que ya usaba `calcularEvaluacionRecompra`: stock de seguridad, ROP, o adaptar).
- **Precio actual por medida** (USD — estas son compras a proveedor chino, nunca mezcles con MXN en ningún KPI, por la regla del proyecto).
- **Estimador de cantidad a pedir**, con la fórmula validada en esta conversación: `par = stockAntesDelUltimoPedido + cantidadPedida`, `sugerido = max(0, par - stockActual)`. A diferencia del Excel (que fue un cálculo de un solo momento), esto debe quedar modelado para que cada vez que se registre un pedido nuevo, ese pedido se vuelva la nueva base para el siguiente cálculo — no debe ser una foto fija.
- **Historial de pedidos por medida** (como mínimo: fecha, piezas, precio unitario, proveedor) para poder comparar cualquier pedido contra el anterior, no solo marzo contra hoy.
- **Comparativa entre el pedido sugerido/actual y el último pedido real**, con el total en USD de cada uno.
- Antes de cualquier acción que escriba una requisición u orden real en Firestore a partir de una sugerencia, el usuario debe poder revisar y ajustar cantidades — nunca un botón que dispare una compra real directo desde un número calculado, sin paso de revisión humana (esto es literalmente lo que causó el incidente P1).

**5. Convenciones a seguir (no te las saltes):**
- TypeScript estricto, sin `any` ni `@ts-ignore`.
- Modelo de datos en `lib/schemas.ts` con Zod (nuevo(s) tipo(s), ej. `EndmillMedida`, `PedidoEndmills`).
- CRUD/Firestore en un `lib/endmills.ts` nuevo — usa `crearRepositorio<T>()` de `lib/repositorio.ts` igual que `lib/pedidos-almacen.ts`, no reinventes el boilerplate de timestamps/auditoría.
- Hook de datos en `lib/hooks/useEndmills.ts` (mismo patrón que `usePedidosAlmacen.ts`: suscripción en vivo + fetch manual + estados de loading/error).
- UI: evalúa si va como pestaña nueva dentro de `/almacen` (junto a Entradas/Salidas, mismo patrón de tabs que `app/almacen/page.tsx`) o como ruta propia — pero justifícalo en el spec, no lo asumas. Usa primitivas de `components/ui/` (shadcn/ui) antes de construir UI a mano.
- Permisos: decide si va bajo el módulo `almacen` existente o si necesita un módulo nuevo en `lib/roles.ts` + `firestore.rules` (si es nuevo, usa un nombre que no colisione con el retirado `reabastecimiento-rop`). Actualiza `firestore.rules` con el mismo patrón `tieneModulo(...)` que ya usan `almacen-entradas` / `pedidos-almacen`.
- Errores de red/sistema nunca rompen la UI — banner + reintento, como en el resto de la app.
- Tests en Vitest para la lógica pura (fórmula de par/sugerido, semáforo de stock) — el módulo retirado ya tenía `tests/recompra-herramientas.test.ts`, revísalo como referencia de qué casos cubrir.

Al terminar el spec y el plan, preséntamelos y espera mi ok antes de generar código.
