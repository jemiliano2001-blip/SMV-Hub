# Firebase App Check

App Check evita que scripts externos abusen de las claves públicas de Firebase
para leer precios o escribir en Firestore sin pasar por la app web legítima.

## 1. Registrar reCAPTCHA v3

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto `smv-brain`
2. APIs & Services → Credentials → Create credentials → **reCAPTCHA v3**
3. Dominios: `localhost`, dominio de Firebase Hosting, y `hub.smv.com` si aplica
4. Copia la **site key** → `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

## 2. Activar en Firebase Console

1. Firebase Console → **App Check** → Apps → tu app web
2. Proveedor: **reCAPTCHA v3** → pegar site key
3. Guardar

## 3. Variables de entorno

| Entorno | Variable |
|---------|----------|
| Local | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` + `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` en `.env.local` |
| CI/prod | GitHub Secrets: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (ya inyectada en build) |

### Debug token (desarrollo)

1. App Check → **Manage debug tokens** → Add debug token
2. En `.env.local`: `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN=<token>`
3. Reinicia `npm run dev`

## 4. Enforcement (después de validar métricas)

Cuando el 100% del tráfico legítimo muestre tokens en App Check → Metrics:

1. Firestore → Enforce App Check
2. Storage → Enforce App Check
3. Cloud Functions (callables) → Enforce App Check

Las reglas en `firestore.rules` y `storage.rules` ya exigen `request.app != null`.
Los callables verifican `context.app` en `functions/src/auth.ts`.

## 5. Desactivar temporalmente (emergencia)

- Functions: `APP_CHECK_ENFORCE=false` en configuración de Cloud Functions
- Reglas: revertir commit que añade `appCheckValido()` y usar workflow manual **rules-only**
