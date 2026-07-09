# Proyecto Firebase de desarrollo (`smv-brain-dev`)

Separar desarrollo de producción evita que pruebas locales borren o corrompan
datos reales del taller (compras, precios, OTs Fisher).

## Crear el proyecto (una vez, en consola)

1. [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Nombre: `smv-brain-dev` (ID sugerido: `smv-brain-dev`)
3. Desactiva Google Analytics si no lo necesitas en dev
4. En el proyecto prod `smv-brain`, anota la configuración de la app web

## Replicar servicios en dev

| Servicio | Acción |
|----------|--------|
| Firestore | Crear base de datos **nombrada** `compras-americanas` (mismo ID que prod) |
| Authentication | Habilitar **Google** como proveedor |
| Storage | Crear bucket por defecto |
| App Check | Misma config reCAPTCHA v3 + debug tokens para localhost |

## Desplegar reglas en dev

```bash
firebase use development
firebase deploy --only firestore:rules,storage
firebase use production   # volver a prod
```

El alias `development` → `smv-brain-dev` está en [`.firebaserc`](../../.firebaserc).

## Variables locales

Copia [`.env.example`](../../.env.example) a `.env.local`:

```bash
cp .env.example .env.local
```

Rellena con credenciales de **smv-brain-dev** (no prod):

```
NEXT_PUBLIC_FIREBASE_PROJECT_ID=smv-brain-dev
```

## Regla de oro

| Entorno | Proyecto | Quién escribe |
|---------|----------|---------------|
| `npm run dev` local | `smv-brain-dev` | Desarrolladores |
| Push a `main` (CI) | `smv-brain` | GitHub Actions únicamente |

Nunca pongas credenciales de `smv-brain` en `.env.local`.

## Datos de prueba

Opcional: importar un subconjunto anonimizado desde prod (solo con permiso explícito):

```bash
# Export desde prod (admin)
gcloud firestore export gs://smv-brain-firestore-backups/dev-seed/ \
  --project=smv-brain --database=compras-americanas

# Import en dev
gcloud firestore import gs://smv-brain-firestore-backups/dev-seed/ \
  --project=smv-brain-dev --database=compras-americanas
```
