## 2026-06-16T21:15:03Z
You are worker_ordenes_page_1. Your working directory is D:\proyectos_code\SMV\compras-americanas\.agents\worker_ordenes_page_1.
Please implement the /ordenes page in the Next.js application.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Especifications:
- Create `app/ordenes/page.tsx` (Server Component) to render the overall layout/structure.
- Create `app/ordenes/OrdenesList.tsx` (Client Component) to handle interactivity: fetching, rendering, detail modal, and deletion.
- Fetch all orders using `listarOrdenes()` from `@/lib/ordenes`.
- Display a clean, responsive table or card list of orders.
- Each order should display its: ID, proveedor, requisitor, orden de trabajo, empresa, total, fecha (formatted creadoEn), and estado (as a color-coded badge: pendiente = yellow, aprobada = green, rechazada = red).
- Implement viewing order details: clicking a row/button should open a modal or side-panel showing details, including the items list (descripcion, cantidad, precioUnitario, total), linkProveedor (if present, link to it), fechaEntrega (if present), and the invoice image if `imagenUrl` is present.
- Implement order deletion: clicking a delete button should prompt for confirmation (optional, standard browser confirm is fine), call `eliminarOrden(id)` from `@/lib/ordenes`, and remove the order from the list.
- Provide a navigation header/links back to Home (`/`), Nueva Compra (`/nueva-compra`), and Importar CSV (`/importar`).
- Handle loading states, empty state ("No hay órdenes de compra registradas"), and error states.

Verification:
- Verify that `npm run lint` and `npm run build` run without errors or warnings.

Write a handoff.md in your directory D:\proyectos_code\SMV\compras-americanas\.agents\worker_ordenes_page_1\ when done. Then send a message to me.
