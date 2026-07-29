# Firebase App Check

App Check complementa Firebase Auth y las reglas; no las sustituye. El cliente
web de SMV Hub usa reCAPTCHA v3 mediante `lib/app-check.ts`.

## Estado actual

- El SDK solo se inicializa cuando existe `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
- Firestore y Storage **no están aplicando enforcement actualmente**:
  `appCheckValido()` devuelve `true` en ambas reglas desde 2026-07-13, después de
  que una configuración incompleta causara respuestas 403 en producción.
- Los callables de Hub validan `context.app` por defecto en
  `functions/src/auth.ts`. `APP_CHECK_ENFORCE=false` desactiva esa validación de
  manera temporal.

No describas App Check como una barrera activa para Firestore/Storage hasta
completar la reactivación siguiente.

## 1. Registrar la aplicación web

1. Crea o identifica una clave reCAPTCHA v3 para los dominios autorizados.
2. En Firebase Console → App Check → Apps, registra la Web App del entorno.
3. Selecciona reCAPTCHA v3 y vincula la clave.
4. Incluye `localhost`, el dominio real de Firebase Hosting y cualquier dominio
   personalizado vigente.
5. Configura `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en el entorno correspondiente.

Producción y `smv-brain-dev` requieren registros y tokens independientes.

## 2. Desarrollo local

`lib/app-check.ts` lee `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` y lo asigna antes de
inicializar el SDK.

1. Genera o captura un debug token para la Web App de `smv-brain-dev`.
2. Regístralo en Firebase Console → App Check → Manage debug tokens.
3. Añádelo a `.env.local`:

```dotenv
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<site-key-dev>
NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN=<debug-token-dev>
```

4. Reinicia `npm.cmd run dev` y confirma que ya no hay intercambios 403.

Nunca versionar el debug token.

## 3. Validación antes del enforcement

Durante una ventana controlada:

1. Verifica login, lecturas/escrituras de cada módulo y cargas de Storage.
2. Ejecuta `npm.cmd run test:e2e`; para el camino del dinero usa
   `smv-brain-dev`.
3. Revisa App Check → Metrics y confirma tokens válidos para el tráfico real.
4. Prueba los callables de compras/finanzas con App Check activo.
5. Conserva un procedimiento de rollback probado.

## 4. Reactivar Firestore y Storage

Solo después de la validación:

1. Cambia `appCheckValido()` de `return true` a
   `return request.app != null` en `firestore.rules` y `storage.rules`.
2. Ejecuta pruebas de reglas, lint, tests, build y E2E.
3. Despliega únicamente reglas:

```powershell
npx.cmd firebase-tools deploy --project smv-brain --only firestore:rules,storage
```

4. Supervisa errores 401/403 y App Check Metrics.

El workflow manual `rules-only` de `.github/workflows/ci.yml` ofrece el mismo
alcance sin desplegar Hosting ni Functions.

## Rollback

Si usuarios legítimos quedan bloqueados:

1. Restaura `appCheckValido()` a `return true` en ambas reglas.
2. Despliega solo `firestore:rules,storage`.
3. Para callables, usa `APP_CHECK_ENFORCE=false` únicamente mientras se corrige
   la configuración y vuelve a activarlo después.

Documenta la causa (dominio, site key, debug token o registro de app) antes de
otro intento.
