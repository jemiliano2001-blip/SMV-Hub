# SMV Hub

Plataforma interna de SMV Maquinados — compras, diseño y operación del taller.
Reemplaza flujos basados en Excel y automatiza la extracción de datos de facturas mediante IA.

## 🚀 Características Principales

- **Gestión de Compras y Órdenes**: Extracción inteligente de facturas y órdenes de compra con la API de Gemini (Google AI), validación de montos (con impuestos y envíos), y trazabilidad en múltiples monedas.
- **Cotizaciones e Importación**: Importación masiva vía CSV de órdenes de proveedores como McMaster-Carr y Grainger, con validación pre-carga.
- **Almacén y Operaciones**:
  - Catálogo de operadores.
  - Entradas y salidas de almacén.
  - Control de tiempo de baños (con generación de tablas dinámicas automatizadas).
  - Control de horas extra semanales.
- **Requisiciones y Órdenes de Servicio**: Tracking de solicitudes internas y OTs con proveedores externos.
- **Reportes**: Generación de reportes PDF y análisis con KPIs sobre toda la operación.

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router)
- **Frontend:** React 19, Tailwind CSS v4, Lucide Icons, Zod (Validación)
- **Backend & DB:** Firebase v12 (Firestore, Auth, Storage)
- **IA:** Integración nativa con Gemini (REST) para estructuración de datos de recibos y facturas
- **Scraping:** Cheerio para extracción en background de precios de proveedores
- **Testing:** Vitest

## 💻 Desarrollo Local

1. Instala las dependencias:
```bash
npm install
```

2. Configura las variables de entorno en un archivo `.env.local`:
```bash
# Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini (IA Extracción)
GEMINI_API_KEY=

# (Opcional) Bypass de login en dev
# NEXT_PUBLIC_DEV_AUTH_BYPASS=true
```

3. Levanta el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## 🧪 Comandos Útiles

```bash
npm run build          # Build para producción
npm run lint           # Chequeo estático (ESLint)
npm test               # Ejecutar pruebas unitarias (Vitest)
```

## 🔒 Seguridad
Todo el acceso de lectura y escritura está controlado por reglas estrictas en `firestore.rules` (whitelist de emails) y validaciones Zod estrictas antes de persistir datos en Firebase.
