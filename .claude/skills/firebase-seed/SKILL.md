---
name: firebase-seed
description: Genera un script Node.js para insertar datos de prueba en Firestore (base compras-americanas, colección ordenes). Útil para pruebas de UI con datos controlados.
disable-model-invocation: true
---

Genera `scripts/seed-dev.mjs` que inserte 15-20 órdenes de prueba en la base `compras-americanas`.

Requisitos del dataset:
- Mezcla de estados: pendiente, aprobada, rechazada
- Monedas: mitad USD, mitad MXN (nunca mezclar en totales)
- Proveedores variados: McMaster-Carr, Amazon, eBay, Digi-Key, Mouser, Mercado Libre
- Empresas: "SMV Maquinados" y "Siltek"
- Algunos con fechaEntrega, otros sin ella
- Rango de fechas: últimos 6 meses
- Items realistas: herramientas, refacciones, electrónica industrial

El script debe:
1. Leer credenciales del `.env.local` (NEXT_PUBLIC_FIREBASE_* + NEXT_PUBLIC_FIRESTORE_DATABASE_ID)
2. Usar Firebase Admin SDK o el SDK cliente con emulador
3. Limpiar la colección antes de insertar (modo desarrollo únicamente)
4. Imprimir progreso por fila insertada
