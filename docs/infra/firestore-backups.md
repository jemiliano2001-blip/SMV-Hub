# Backups automáticos de Firestore

SMV Hub guarda compras, precios y operación del taller en Firestore (`compras-americanas`).
La exportación diaria protege contra borrados accidentales o corrupción de datos.

## Configuración inicial (una vez)

1. Autentícate con gcloud: `gcloud auth login` y `gcloud config set project smv-brain`
2. Ejecuta el script:

```bash
chmod +x infra/firestore-backup/setup.sh
./infra/firestore-backup/setup.sh
```

Esto crea:

- Bucket `gs://smv-brain-firestore-backups` con retención de **90 días**
- Cuenta de servicio `firestore-backup@smv-brain.iam.gserviceaccount.com`
- Job de Cloud Scheduler que exporta cada día a las 02:00 (hora Monterrey)

## Verificación

```bash
# Listar exportaciones recientes
gcloud storage ls gs://smv-brain-firestore-backups/automatic/

# Disparar export manual
gcloud firestore export gs://smv-brain-firestore-backups/manual/$(date +%Y-%m-%d) \
  --project=smv-brain \
  --database=compras-americanas
```

## Restauración (trimestral en staging)

Prueba la restauración en `smv-brain-dev` antes de tocar producción:

```bash
gcloud firestore import gs://smv-brain-firestore-backups/automatic/YYYY-MM-DD/ \
  --project=smv-brain-dev \
  --database=compras-americanas
```

## Facturas (Storage)

Las imágenes/PDF en `ordenes/**` viven en Firebase Storage. Para versionado adicional:

```bash
gcloud storage buckets update gs://smv-brain.appspot.com \
  --versioning \
  --project=smv-brain
```

(Ajusta el nombre del bucket según Firebase Console → Storage.)
