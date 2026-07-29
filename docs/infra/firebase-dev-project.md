# Proyecto Firebase de desarrollo (`smv-brain-dev`)

El entorno de desarrollo separa las pruebas que escriben datos de la operación
real en `smv-brain`.

## Servicios requeridos

En Firebase Console crea/configura:

| Servicio | Configuración |
|---|---|
| Firestore | Base nombrada `compras-americanas` |
| Authentication | Google y email/password para el usuario automatizado de E2E |
| Storage | Bucket del proyecto dev |
| App Check | Registro Web App y debug tokens propios de dev, si se va a probar |

Los aliases están definidos en `.firebaserc`:

- `development` → `smv-brain-dev`
- `production` y `default` → `smv-brain`

Comprueba el target antes de cualquier escritura o deploy:

```powershell
npx.cmd firebase-tools use
npx.cmd firebase-tools use development
```

## Configuración local

```powershell
Copy-Item .env.example .env.local
```

Rellena `.env.local` con la Web App de desarrollo:

```dotenv
NEXT_PUBLIC_FIREBASE_PROJECT_ID=smv-brain-dev
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=compras-americanas
```

No uses credenciales de producción en `.env.local`. El login real de Google es
el comportamiento normal; `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` solo sirve para UI
sin acceso real a Firestore.

## Reglas de desarrollo

Antes de desplegar, confirma que el target activo sea `development`:

```powershell
npx.cmd firebase-tools use development
npx.cmd firebase-tools deploy --only firestore:rules,storage
```

Al terminar, puedes restaurar el alias:

```powershell
npx.cmd firebase-tools use production
```

No despliegues Functions desde dev con un comando global ni con `--force`.

## Usuario E2E

`e2e/camino-dinero.spec.ts` usa email/password, escribe en
`smv-brain-dev`, stubea Gemini y limpia los registros que crea. Configura el
usuario con `scripts/crear-usuario-e2e.mjs` y entrega su contraseña mediante
`E2E_TEST_USER_PASSWORD`; no la guardes en Git.

Consulta [../testing/e2e.md](../testing/e2e.md) para el flujo completo.

## Datos de prueba

Prefiere datos sintéticos o emuladores. Una copia anonimizada de producción
requiere autorización explícita, un bucket controlado y validación del destino
antes de importar:

```powershell
gcloud firestore import gs://BUCKET/RUTA-ANONIMIZADA/ `
  --project=smv-brain-dev `
  --database=compras-americanas
```

Nunca uses `smv-brain` como destino de una prueba o seed.
