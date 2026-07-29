---
name: firebase-seed
description: Genera datos de prueba seguros para SMV Hub en emulador o smv-brain-dev. Nunca apunta a producción.
disable-model-invocation: true
---

Genera `scripts/seed-dev.mjs` para insertar 15–20 órdenes en la base
`compras-americanas`, exclusivamente en el emulador o en `smv-brain-dev`.

## Datos

- Estados: `pendiente`, `aprobada` y `rechazada`.
- Monedas: USD y MXN; nunca sumarlas entre sí.
- Proveedores industriales variados.
- Empresas/destinos: `SMV` y `Siltek`.
- Fechas dentro de los últimos seis meses.
- Ítems realistas de herramientas, refacciones y automatización.
- `creadoEn` y `actualizadoEn` válidos; campos conformes a
  `OrdenCompraSchema`.

## Seguridad obligatoria

1. Lee `.env.local` y valida
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID === "smv-brain-dev"`, o exige variables de
   emulador.
2. Rechaza explícitamente `smv-brain`, credenciales de producción y un project
   ID vacío.
3. No limpies una colección completa por defecto. Usa un prefijo/tag único de
   seed y borra solo documentos creados por el propio script.
4. Si se solicita limpieza amplia, exige un flag explícito como
   `--confirm-dev-reset` y vuelve a validar el project ID.
5. Imprime proyecto, base y cantidad antes de escribir; nunca imprimas secretos.

Prefiere Firebase Admin para `smv-brain-dev` con credenciales locales
controladas, o el SDK cliente contra emuladores. Incluye un modo `--dry-run` y
documenta el comando de ejecución.
