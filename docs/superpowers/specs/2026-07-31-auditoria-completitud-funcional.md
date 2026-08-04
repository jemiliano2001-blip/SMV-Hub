# Auditoría de completitud funcional — 2026-07-31

**Estado:** diagnóstico terminado; el lote aplicado está validado en local y las reglas/Hosting del lote aprobado ya fueron desplegados en `smv-brain`. Las decisiones de permisos restantes siguen separadas.

**Alcance confirmado:** controles de UI desconectados de sus datos/lógica y validaciones inconsistentes entre módulos hermanos. Se excluyeron deliberadamente estados de carga, vacío y error, salvo cuando un control funcional dependía directamente de ellos. El análisis de reglas de Firestore fue un grupo separado, para contrastar la UI contra la autorización efectiva.

**Base:** antes de iniciar, Claude verificó `npx tsc --noEmit` limpio y 774 tests verdes. Se realizaron seis grupos: documentos de venta; notificaciones/baños; horas extra/usuarios/operadores; SAT/proveedores; permisos UI↔rules; y carga por rango/paginación.

**Cómo leerlo:** cada hallazgo conserva severidad, confianza y tamaño estimado del arreglo. Los cambios en `firestore.rules` y las decisiones de visibilidad de datos no se deben aplicar en automático: el proyecto Firebase es compartido y requieren una decisión explícita del propietario.

---

## Correcciones iniciadas el 2026-07-31

Estas correcciones ya están aplicadas en el árbol de trabajo y cuentan con pruebas enfocadas o validación estática:

- [x] Baños: rechazar una solicitud ya sin registro usa una escritura idempotente y ya no deja la solicitud pendiente.
- [x] Horas extra: la semana se serializa como fecha local; al eliminar la última hora se limpia `totalHoras`; y un error al cargar operadores se muestra como error.
- [x] Nueva Compra: se elimina el fallback global que podía copiar empresa, cuenta o requisitor de otro proveedor.
- [x] SAT: `/api/sugerir-clave-sat` conserva `terminosPrevios` enviados por Reporte Contable.
- [x] Proveedores: encabezado calcula lead time y scorecard desde el historial disponible; el drawer deja de inventar un scorecard si no recibe evidencia.
- [x] Documentos de venta: la disponibilidad de una remisión descuenta solicitudes pendientes/en proceso del mismo solicitante antes de crear otra. Las solicitudes simultáneas de personas distintas aún requieren un flujo transaccional de servidor.
- [x] Backfill de usuarios: el script reconoce Automatización y refleja los módulos vigentes de las plantillas; no fue ejecutado contra datos reales.
- [x] Notificaciones: audiencia y destinatario se guardan en cada emisión; el cliente consulta por destinatario/audiencia; reglas impiden el feed global, ligan tipo/origen y dejan Baños sólo a super-admins y solicitantes. Se agregaron índices compuestos; no se desplegaron reglas ni datos.
- [x] Reportes: el reporte gerencial consulta por `creadoEn` y `fechaFactura`, por lo que una factura capturada tarde no desaparece del período; el cierre contable carga las órdenes del lote seleccionado aunque sea anterior a la ventana reciente.
- [x] SAT en Cierre Contable: una clave manual sólo se aplica y persiste como validada si existe en el catálogo SAT local; el formato de ocho dígitos por sí solo ya no basta.

Los hallazgos de chat sin aviso y de filtrado visual de documentos de venta quedan resueltos por este lote; la prueba efectiva de las reglas requiere Firebase CLI/emulador o una validación controlada en el proyecto de desarrollo.

Los cambios de Storage y las demás reglas de paridad siguen separados. La audiencia de notificaciones ya cuenta con la decisión explícita del propietario, pero requiere validación de reglas y despliegue posterior.

### Correcciones adicionales aplicadas

- [x] Baños: la resolución de solicitudes es accesible desde un panel dedicado aunque la notificación salga del feed; los contadores respetan el origen filtrado.
- [x] Baños: se puede solicitar eliminación mientras el registro está abierto; un rechazo de IA no puede reenviarse indefinidamente y las escrituras de solicitud/marca son atómicas.
- [x] Gemini para Baños: timeout de 15 segundos, JSON inválido tratado como revisión y fallback al modelo estable `gemini-3.6-flash` cuando un override devuelve 400/404 (modelo confirmado en la documentación oficial).
- [x] Proveedores: lectura restringida a usuarios con proveedores, finanzas, super-admin o break-glass; escritura y borrado restringidos a editores de proveedores.

El despliegue de estas reglas sigue pendiente: Firebase CLI/emulador no está disponible en este entorno y el proyecto `smv-brain` es compartido.

## Prioridad 1 — alto impacto y alta confianza

1. **Chat de documentos de venta sin notificación.** El cliente emite `solicitud_documento_mensaje`, pero `firestore.rules` no acepta ese tipo ni el origen de Baños. La escritura falla y los dos `catch` la silencian: la campana nunca avisa de mensajes nuevos. `lib/documentos-venta.ts`, `lib/notificaciones.ts`, `firestore.rules:364-405`. Esfuerzo: trivial; requiere aprobar el cambio de reglas.
2. **Catálogo de proveedores borrable por usuarios sin el módulo.** La UI exige `proveedores`, pero la colección y sus derivados permiten borrar a cualquier usuario activo. `firestore.rules:662-699`. Esfuerzo: pequeño; requiere aprobar el cambio de reglas compartidas.
3. **Solicitudes de documentos duplicables.** El taller puede pedir la misma línea varias veces porque sólo se compara con `qtyPending` de Odoo, que no se reduce hasta el picking externo. `NuevaSolicitudPanel.tsx`, `lib/documentos-venta-helpers.ts`. Esfuerzo: pequeño.
4. **Resolución de borrado de Baños puede quedar bloqueada para siempre.** Rechazar una solicitud cuyo registro ya fue borrado produce `NOT_FOUND`, devuelve 500 y deja la solicitud pendiente sin camino de recuperación. `app/api/banos/solicitudes-borrado/[id]/resolver/route.ts`. Esfuerzo: trivial.
5. **Solicitudes de borrado de Baños pueden perder su única superficie de resolución.** Aprobar/Rechazar sólo se muestra dentro del feed de las 50 notificaciones más recientes; cuando el aviso sale del feed, el super-admin no puede resolverlo. `lib/notificaciones.ts`, `NotificacionesView.tsx`. Esfuerzo: pequeño.
6. **Reportes gerenciales pueden omitir facturas retroactivas o capturadas tarde.** Se consulta por `creadoEn` con margen fijo de 45 días, pero se decide el período por `fechaFactura`; una diferencia mayor desaparece de KPI, tabla y PDF. `app/reportes/ReporteView.tsx:41-70`, `lib/reportes.ts`. Esfuerzo: pequeño.
7. **Un lote contable antiguo muestra un total pero ninguna línea.** El sidebar conserva 50 lotes sin límite temporal mientras la pantalla carga sólo órdenes del último año. `ReporteContableView.tsx`, `lib/reportes-contables.ts`. Esfuerzo: pequeño.
8. **Horas extra cambia de semana a las 18:00 locales.** `formatSemanaISO()` convierte una fecha local con `toISOString()`, por lo que la llave que se guarda y consulta cambia al día siguiente en Monterrey. `lib/horas-extra-parse.ts:46-52`. Reproducido en `TZ=America/Monterrey`. Esfuerzo: trivial.
9. **Nueva Compra puede contaminar cuenta cargo, empresa o requisitor.** El fallback toma la moda global de sólo las últimas 200 órdenes cuando no hay historial del proveedor y la escribe como dato editado sin marcarlo como sugerencia. `lib/sugerencias-compra.ts`, `NuevaCompraForm.tsx`. Esfuerzo: trivial.
10. **Nueva Compra no permite clasificar SAT durante la captura.** Guarda `claveProdServ: null` y `satPendiente: true`, pero no ofrece sugerencia, alternativa ni selección manual, pese a ser uno de los cuatro puntos de entrada comprometidos. `app/nueva-compra/NuevaCompraForm.tsx`. Esfuerzo: mediano.
11. **Órdenes valida formato SAT, no existencia.** El modal acepta cualquier secuencia de ocho dígitos, la marca válida y la persiste como mapeo validado; una clave inexistente puede contaminar sugerencias posteriores. `app/ordenes/ModalSugerirClavesSat.tsx:215-245`. Esfuerzo: pequeño.
12. **Proveedores muestra inteligencia inventada.** El encabezado pasa `Lead Time 3.5`, `Scorecard 4.8` y cero proveedores fantasma de forma fija; el drawer usa otro scorecard fijo si no recibe uno. `app/proveedores/page.tsx:1329-1342`, `DrawerDetalleProveedor.tsx:25-46`. Esfuerzo: pequeño.

## Hallazgos que requieren decisión, no implementación automática

- **Permisos de Firestore.** Además de proveedores, las colecciones de Baños, horas extra, almacén, reportes contables, asignaciones SAT y configuraciones tienen al menos una operación más amplia que el módulo oculto por UI. Cerrar cada una es recomendable desde seguridad, pero modifica acceso en el Firebase compartido; debe aprobarse el conjunto exacto de módulos/roles antes de desplegar reglas.
- **Audiencia de notificaciones.** La actual colección se consulta sin filtrar destinatario u origen y expone, por ejemplo, datos de documentos de venta a usuarios que sólo tienen Baños. La especificación de documentos de venta describía avisos dirigidos, pero resolverlo implica modelo de destinatarios, query y regla. Es una decisión de privacidad/producto.
- **Auto-aprobación determinista de Baños.** El audit detectó que `evaluarReglaAutoAprobacion()` ya no se invoca. No debe reactivarse: el cambio anterior solicitado sustituyó esas heurísticas por Gemini estructurado y revisión humana si hay ambigüedad, error o falta de credenciales. Sí quedan código, comentarios y nombres de tests obsoletos para limpiar en un cambio separado.

## Prioridad 2 — correcciones seguras y de impacto medio

- En documentos de venta: esperar permisos antes de elegir la UI de ventas; exigir de verdad el motivo de rechazo; mostrar quién tomó una solicitud y el folio/motivo después de completarla; comprobar el estado actual antes de transición; y resolver/degradar con claridad los deep links que no pertenecen a la lista cargada.
- En notificaciones y Baños: alinear los contadores al filtro visible; permitir solicitar/borrar registros aún abiertos; poner timeout y modelo válido para Gemini; impedir reenvíos infinitos después de un rechazo; y hacer atómica la creación de solicitud y marca en el registro.
- En horas extra/usuarios/operadores: cancelar el debounce al perder foco; permitir que `totalHoras` sea cero; distinguir error de catálogo de un equipo completo; corregir el backfill de la plantilla `automatizacion`; auditar altas y restablecimientos de contraseña; y validar renombres duplicados de operadores.
- En reportes/paginación: mostrar siempre el alcance cargado de filtros de órdenes; no esconder “Cargar más” al no haber coincidencias locales; usar el historial completo al sugerir SAT desde cierre contable; y no presentar como globales los KPI que se calculan sobre una página.
- En SAT/proveedores: conservar `terminosPrevios` en la API; traducir/glosar la búsqueda manual inglesa; invalidar caché cuando cambie un mapeo validado; excluir precios cero también del presupuesto; y no declarar una contingencia de proveedor activa si no existe matriz persistida.

## Detalle por grupo

<details>
<summary>Grupo 1 — documentos de venta</summary>

- **[alto][alta]** No se impiden solicitudes duplicadas ni una cantidad ya solicitada para una misma línea Odoo; puede enviarse/embarcarse dos veces. `NuevaSolicitudPanel.tsx`, `lib/documentos-venta-helpers.ts`. Esfuerzo: pequeño.
- **[medio][alta]** La UI de ventas aparece brevemente como UI de taller porque `usePermisos` se lee sin esperar `cargando`. `DocumentosVentaView.tsx`. Esfuerzo: trivial.
- **[medio][alta]** El llamador convierte cualquier motivo vacío en `"Cancelada"`, anulando la validación del motivo requerido. `DetalleVentasSimple.tsx`, `lib/documentos-venta.ts`. Esfuerzo: trivial.
- **[medio][alta]** Se persiste `atendidoPor*`, pero no se muestra; dos atendedores pueden trabajar la misma solicitud sin verlo. `lib/documentos-venta.ts`, `ModoVentasView`. Esfuerzo: pequeño.
- **[medio][alta]** El modo ventas no vuelve a mostrar folio Odoo ni motivo tras resolver. `DetalleVentasSimple.tsx`. Esfuerzo: trivial.
- **[medio][alta]** Un deep link a una solicitud ajena falla silenciosamente si no está en la lista suscrita. `DocumentosVentaView.tsx`. Esfuerzo: pequeño.
- **[medio][alta]** Las notificaciones se emiten sin destinatario y las pruebas sólo verifican títulos, no destinatario. `lib/documentos-venta.ts`, `tests/documentos-venta-notifs.test.ts`. Decisión de producto/privacidad.
- **[medio][alta]** La transición confía en el estado `desde` del cliente y puede sufrir last-write-wins. `lib/documentos-venta.ts`. Esfuerzo: trivial.
- **[bajo][alta]** El taller muestra estados crudos y ventas etiquetas de negocio distintas. `DocumentosVentaView.tsx`, `SolicitudDetalleModal.tsx`. Esfuerzo: trivial.
- **[bajo][alta]** `SolicitudDetalleModal` recibe `atiende={false}` siempre; su rama de atendedor es inalcanzable. `DocumentosVentaView.tsx`. Esfuerzo: trivial.
- **[bajo][alta]** `ColaVentasPanel.tsx` quedó huérfano. No afecta el flujo actual; retirarlo requiere confirmación de limpieza.
- **[bajo][alta]** Al borrar cantidad se muestra el id interno de línea Odoo y un error poco útil. `NuevaSolicitudPanel.tsx`, `lib/documentos-venta-helpers.ts`. Esfuerzo: trivial.
- **[bajo][media]** La sync no filtra líneas de sección/nota de Odoo; pueden aparecer como partidas de cantidad cero. `functions/src/odoo-ventas-sync.ts`, `odoo-ventas-mapeo.ts`. Esfuerzo: trivial.

</details>

<details>
<summary>Grupo 2 — notificaciones y Baños</summary>

- **[alto][alta]** La resolución de solicitudes de borrado se vuelve inaccesible al expulsarse del feed de 50. `lib/notificaciones.ts`, `NotificacionesView.tsx`. Esfuerzo: pequeño.
- **[medio][alta]** Las pills Todas/No leídas/Leídas cuentan el feed total, no el origen filtrado. `NotificacionesView.tsx`. Esfuerzo: trivial.
- **[alto][alta]** Rechazar una solicitud cuyo registro ya no existe deja el estado pendiente de forma irreversible. `app/api/banos/solicitudes-borrado/[id]/resolver/route.ts`. Esfuerzo: trivial.
- **[medio][alta]** Registros abiertos no exponen eliminar ni solicitar eliminación; un accidental debe cerrarse primero. `RegistroBanoList.tsx`. Esfuerzo: pequeño.
- **[medio][media]** Gemini para Baños no tiene timeout ni fallback de modelo; validar el modelo real contra la documentación oficial antes de cambiarlo. `lib/banos-ia.ts`. Esfuerzo: trivial.
- **[bajo][alta]** Tras un rechazo IA se puede volver a enviar infinitamente la misma solicitud. `app/api/banos/solicitudes-borrado/route.ts`. Esfuerzo: trivial.
- **[bajo][alta]** Crear solicitud y marcar registro no es atómico; un fallo intermedio deja la solicitud creada pero responde error. Misma ruta. Esfuerzo: trivial.
- **[bajo][media]** Limpiar el mes consulta y suscribe todo el histórico de Baños. `CuentaDiaria.tsx`, `ResumenMensual.tsx`, `lib/banos.ts`. Esfuerzo: trivial.
- **[no es bug]** Las reglas deterministas de auto-aprobación están obsoletas porque el producto eligió Gemini real con fallback a revisión humana; no reactivarlas.

</details>

<details>
<summary>Grupo 3 — horas extra, usuarios y operadores</summary>

- **[alto][alta]** `toISOString()` desplaza la semana a las 18:00 locales. `lib/horas-extra-parse.ts`. Esfuerzo: trivial.
- **[medio][alta]** Blur y debounce pueden crear dos registros para empleado/semana. `VistaHoy.tsx`, `useHorasExtra.ts`. Esfuerzo: trivial.
- **[medio][alta]** Editar todos los días a cero conserva el total previo en el campo persistido y grilla. `useHorasExtra.ts`. Esfuerzo: trivial.
- **[medio][media]** “Cargar equipo” informa éxito ante un error de lectura de operadores. `HorasExtraGrid.tsx`, `VistaHoy.tsx`. Esfuerzo: pequeño.
- **[bajo][alta]** El filtro mensual asigna una semana completa a su miércoles de inicio. `ResumenMensual.tsx`, `lib/horas-extra.ts`. Esfuerzo: trivial o cambio de etiqueta.
- **[medio][alta]** Crear usuarios y resetear contraseñas no deja evento de auditoría. Rutas API de usuarios. Esfuerzo: trivial.
- **[medio][alta]** El backfill todavía enumera cuatro plantillas, salta automatización y puede quitar módulos actuales. `scripts/backfill-modulos-usuarios.mjs`. Esfuerzo: pequeño.
- **[bajo][alta]** La etiqueta de `editaHorasExtra` no menciona automatización. `app/usuarios/page.tsx`. Esfuerzo: trivial.
- **[medio][alta]** Renombrar operador permite duplicado y desincroniza nombre/área histórica de horas extra. `OperadoresList.tsx`. Esfuerzo: pequeño.

</details>

<details>
<summary>Grupo 4 — SAT híbrido y proveedores</summary>

### SAT

- **[alto][alta]** Nueva Compra crea partidas SAT pendientes, pero no expone búsqueda, sugerencia ni alternativas. `NuevaCompraForm.tsx`. Esfuerzo: mediano.
- **[medio][alta]** Reporte Contable envía `terminosPrevios`, pero `ItemRequestSchema` no los declara y Zod los elimina antes de `sugerir-clave.ts`; se pierde la traducción ya obtenida. `app/api/sugerir-clave-sat/route.ts`, `ReporteContableView.tsx`. Esfuerzo: trivial.
- **[alto][alta]** Una clave manual de ocho dígitos se persiste como validada sin comprobar que exista en el catálogo; después alimenta mapeos e historial. `ModalSugerirClavesSat.tsx`. Esfuerzo: pequeño.
- **[medio][alta]** La búsqueda manual de `/claves-sat` e inline en Órdenes consulta el catálogo español sin glosario/traducción; `Compression Spring` no resuelve como el flujo automático. `app/api/claves-sat/route.ts`, `lib/sat/buscar.ts`. Esfuerzo: pequeño.
- **[medio][alta]** La caché se revisa antes de los mapeos validados y no se invalida al corregir una asignación; una clave vieja puede durar 24 horas. `lib/sat/sugerir-clave.ts`. Esfuerzo: pequeño.

### /proveedores

- **[alto][alta]** El encabezado muestra conteo fantasma, lead time y scorecard fijos, y el panel para corregir vínculos fantasma no está montado. `app/proveedores/page.tsx:1329-1342`, `PanelProveedoresFantasma.tsx`. Esfuerzo: pequeño.
- **[alto][alta]** El drawer enseña un scorecard de ejemplo cuando no recibe datos calculados. `DrawerDetalleProveedor.tsx:25-46`. Esfuerzo: pequeño.
- **[medio][alta]** El comparador omite precios cero sólo al elegir el mejor precio; aún los muestra y permite agregarlos a presupuesto. `ComparadorPreciosInsumos.tsx`. Esfuerzo: trivial.
- **[medio][alta]** La matriz presenta primeros proveedores como primario/respaldo y “Contingencia CNC Activa” sin matriz persistida; incluso permite el mismo en ambos puestos. `PanelInteligencia360.tsx`. Esfuerzo: pequeño.
- **[bajo][alta]** Scorecards se calculan sobre 12 meses, pero la tabla rotula “Órdenes Totales” y se anuncia en tiempo real. `PanelInteligencia360.tsx`, `app/proveedores/page.tsx`. Esfuerzo: trivial.

</details>

<details>
<summary>Grupo 5 — paridad permisos UI ↔ Firestore/Storage</summary>

- **[alto][alta]** `solicitud_documento_mensaje` y tipos Baños no pasan `notificacionValida`; el chat falla en silencio. `firestore.rules:364-405`. Requiere decisión y despliegue de reglas.
- **[alto][alta]** Cualquier usuario activo puede leer/escribir/borrar partes del catálogo de proveedores pese a que la UI lo gatea. `firestore.rules:662-699`. Requiere decisión y despliegue de reglas.
- **[medio][alta]** Horas extra puede leerse por todo usuario activo aunque NavBar/AuthGuard requieren el módulo. `firestore.rules:472`. Decisión de acceso.
- **[medio][alta]** Baños permite leer/crear/actualizar a todo usuario activo, no sólo al módulo Baños. `firestore.rules:420-428`. Decisión de acceso.
- **[medio][alta]** Entradas y salidas de almacén no exigen módulo aunque la UI sí. `firestore.rules:268-303`. Decisión de acceso.
- **[medio][alta]** Lotes contables pueden leerse y crearse sin módulo Reportes. `firestore.rules:580-584`. Decisión de acceso.
- **[medio][media]** La plantilla Compras permite Nueva Compra pero no Órdenes, Reportes ni Claves SAT. `lib/roles.ts`. Decisión de matriz de producto.
- **[medio][alta]** Quien sólo tiene Baños puede leer contenido de notificaciones de documentos de venta; el filtrado actual es sólo visual. `lib/notificaciones.ts`, `NotificacionesView.tsx`, `firestore.rules`. Decisión de privacidad.
- **[bajo][alta]** `sat_asignaciones`, mapeos IA y configuraciones son escribibles por cualquier usuario activo. `firestore.rules`. Decisión de acceso.
- **[bajo][media]** La regla y TypeScript de `puedeEditarHorasExtra` pueden divergir ante documentos manipulados con `rol` y `plantilla` contradictorios. `firestore.rules`, `lib/roles.ts`. Esfuerzo: trivial tras aprobar el criterio.
- **[bajo][media]** `esSuperAdmin` con un valor no booleano abre UI y cierra servidor por fallbacks distintos. `firestore.rules`, `lib/roles.ts`. Esfuerzo: trivial.
- **[bajo][media]** Leer `rol` opcional sin guarda en reglas puede denegar un documento válido que sólo tenga plantilla. `firestore.rules`. Esfuerzo: trivial.
- **[bajo][alta]** Storage deja subir archivos de pedidos-almacén a usuarios sin ese módulo, a diferencia de Firestore. `storage.rules`. Decisión y despliegue de reglas.

Verificado correcto: transiciones de documentos de venta con `atiendeDocumentosVenta`, aislamiento de `notificaciones_leidas`, solicitudes de borrado de Baños, break-glass y cierre catch-all de reglas.

</details>

<details>
<summary>Grupo 6 — carga por rango y paginación</summary>

- **[alto][alta]** Reportes consulta por `creadoEn` con ventana ±45 días, pero filtra por `fechaFactura`; facturas retroactivas desaparecen. `ReporteView.tsx`, `lib/reportes.ts`. Esfuerzo: pequeño.
- **[alto][alta]** Elegir un lote contable anterior a la ventana muestra el total en sidebar y cero líneas en tabla. `ReporteContableView.tsx`, `lib/reportes-contables.ts`. Esfuerzo: pequeño.
- **[medio][alta]** El tab de compras pendientes promete todas, pero sólo cubre 12 meses por `creadoEn`. `ReporteContableView.tsx`. Esfuerzo: trivial para etiquetar; pequeño para ampliar la consulta.
- **[medio][alta]** El historial SAT de Reporte Contable usa sólo órdenes pendientes, excluyendo las cerradas que contienen claves validadas. `ReporteContableView.tsx`. Esfuerzo: trivial.
- **[medio][alta]** Filtros/pills de Órdenes trabajan sobre la rebanada cargada pero el contador dice “de total” y las acciones masivas actúan parcialmente. `OrdenesFiltros.tsx`, `OrdenesList.tsx`. Esfuerzo: trivial de alcance visible.
- **[medio][alta]** Si un filtro no tiene coincidencias locales, desaparece “Cargar más”, aunque sí puede haber coincidencias en servidor. `OrdenesList.tsx`. Esfuerzo: trivial.
- **[bajo][alta]** Se puede interactuar con buscador/selects mientras la carga completa aún muestra opciones de la rebanada anterior. `OrdenesList.tsx`. Esfuerzo: trivial.
- **[alto][alta]** Tres KPIs de Flujo de requisiciones usan la página cargada mientras el total usa `getCountFromServer`. `RequisicionesList.tsx`, `useRequisicionesFlujo.ts`. Esfuerzo: pequeño.
- **[medio][alta]** El tab Flujo pinta requisiciones sin `estatusFlujo` como “ENVIADA”, aunque sus KPI las excluyen. `RequisicionesList.tsx`, `lib/requisiciones.ts`. Esfuerzo: pequeño.
- **[medio][alta]** Cotizaciones se pagina por `creadoEn`, pero marca Fecha como orden activo y reordena sólo la página; “Cargar historial” cambia radicalmente el resultado. `lib/cotizaciones.ts`, `CotizacionesList.tsx`. Esfuerzo: pequeño.
- **[alto][alta]** Sugerencia global de campos en Nueva Compra puede escribir valores de proveedores ajenos sobre datos de empresa/cuenta/requisitor. `lib/sugerencias-compra.ts`, `NuevaCompraForm.tsx`. Esfuerzo: trivial.
- **[bajo][alta]** Scorecards de proveedores declaran totales sin expresar que la fuente es una ventana de 12 meses. `PanelInteligencia360.tsx`. Esfuerzo: trivial.

Verificado correcto: no hay mezcla de monedas en Reportes, Reporte Contable ni la inteligencia cruzada de proveedores; las primitivas de paginación de Órdenes y Cotizaciones calculan `hayMas` y deduplican correctamente. 

</details>

---

## Estado posterior a las correcciones (2026-07-31)

El lote de correcciones mecánicas aprobado ya cubre estos puntos adicionales:

- [x] Nueva Compra expone clave SAT por partida: captura manual de ocho dígitos, sugerencia IA y alternativas seleccionables; al guardar, `satPendiente` se deriva de la clave realmente capturada.
- [x] Cierre Contable permite cargar el historial completo bajo demanda; el historial SAT para sugerencias usa todas las órdenes cargadas y los lotes históricos se consultan por su `reporteContableId`.
- [x] El tab de compras pendientes declara su ventana de 12 meses en la UI y ofrece carga explícita del historial completo, sin convertir una lectura pesada en montaje automático.
- [x] Los KPI de Flujo de requisiciones ya no presentan como globales los conteos de una página: muestran `—` hasta completar el historial; el conteo de enviadas incluye registros legacy sin `estatusFlujo`.
- [x] Las transiciones de estado de documentos de venta leen y actualizan el estado actual dentro de una transacción; una pestaña desactualizada recibe un error y no puede hacer last-write-wins.
- [x] Las nuevas solicitudes de remisión pasan por `/api/documentos-venta/solicitudes`; el servidor valida la SO actual, suma solicitudes activas y reserva cada línea en una transacción. El `create` directo de Firestore quedó cerrado en las reglas.
- [x] Almacén: lecturas/escrituras de entradas y salidas exigen `almacen`; la colección y Storage de Pedidos de almacén exigen `pedidos-almacen`, y la gestión exige además `nueva-compra`.

La tanda continuada del 2026-08-01 agregó estas correcciones seguras:

- [x] Modo ventas: la cola muestra quién atiende una solicitud; el detalle conserva atendente, folio Odoo y motivo de cancelación cuando existen.
- [x] Modo ventas: cancelar exige un motivo no vacío tanto en la UI como en la llamada de transición; ya no se sustituye silenciosamente por `Cancelada`.
- [x] Horas extra: `Cargar equipo` distingue carga, lista vacía y error de lectura, y deja el error visible para poder reintentar.
- [x] SAT: Nueva Compra y el modal de Órdenes sólo persisten una clave manual como validada si existe en el catálogo local; una clave inexistente queda pendiente.
- [x] Proveedores: el encabezado y el drawer ya consumen datos calculados o muestran `Sin datos`; los hallazgos de métricas fijas del audit original estaban desactualizados.
- [x] Documentos de venta: un deep link recupera la solicitud puntual aunque haya quedado fuera de la suscripción limitada a 200 registros, respetando las reglas de Firestore.
- [x] Horas extra: al perder foco o usar un chip se cancela el debounce pendiente y una fila no puede iniciar dos escrituras simultáneas.
- [x] Operadores: el renombrado rechaza duplicados contra el catálogo cargado y deja el mensaje visible para corregirlo.

Las primitivas de Órdenes y Cotizaciones ya disponían de acciones explícitas de `Cargar más`/`Cargar historial completo`; por eso sus hallazgos de paginación se mantienen como verificación de alcance visible, no como cambios nuevos en este lote.

La reserva transaccional ya está implementada en código y reglas, pero requiere desplegar el Route Handler y las reglas juntos; si se despliegan por separado, una versión vieja del cliente puede fallar al crear solicitudes. También siguen pendientes las demás reglas de Firestore/Storage que requieren una matriz de permisos y despliegue en el proyecto compartido.

## Próximo paso

El diagnóstico inicial contiene 62 hallazgos brutos; uno fue reclasificado como comportamiento deliberado de Gemini en Baños. Para cerrar el trabajo restante hay que elegir:

1. Aprobar el conjunto concreto de reglas/privacidad a corregir.
2. Desplegar juntos el Route Handler de documentos de venta y el cierre de `allow create`.
3. Mantener los demás arreglos de permisos/Storage como lote separado y desplegarlos con `firebase deploy --only` selectivo.

No se debe ejecutar un “arregla todo” sobre reglas compartidas sin resolver el primer punto: esos cambios alteran acceso a datos y semántica de notificaciones.
