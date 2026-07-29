# Backups automáticos de Firestore

SMV Hub usa la base nombrada `compras-americanas`. El script
`infra/firestore-backup/setup.sh` configura exportaciones diarias en el proyecto
`smv-brain`.

## Requisitos y alcance

- `gcloud` autenticado con permisos de import/export, Storage y Scheduler.
- Bash (Cloud Shell, WSL o Git Bash); el script no es PowerShell nativo.
- Confirmación explícita de proyecto y base antes de ejecutarlo.

El script crea:

- `gs://smv-brain-firestore-backups`;
- política de ciclo de vida de 90 días;
- cuenta `firestore-backup@smv-brain.iam.gserviceaccount.com`;
- job `firestore-daily-export` a las 02:00 de `America/Monterrey`.

## Configuración inicial

```bash
gcloud auth login
gcloud config set project smv-brain
./infra/firestore-backup/setup.sh \
  --project smv-brain \
  --database compras-americanas
```

El script reemplaza el job de Scheduler con el mismo nombre. Revisa sus
parámetros antes de volver a ejecutarlo.

## Verificación

```powershell
gcloud scheduler jobs describe firestore-daily-export `
  --project=smv-brain `
  --location=us-central1

gcloud storage ls gs://smv-brain-firestore-backups/automatic/
```

Export manual desde PowerShell:

```powershell
$fechaBackup = Get-Date -Format 'yyyy-MM-dd'
gcloud firestore export "gs://smv-brain-firestore-backups/manual/$fechaBackup" `
  --project=smv-brain `
  --database=compras-americanas
```

## Prueba de restauración

Prueba primero en `smv-brain-dev`, nunca directamente en producción:

```powershell
gcloud firestore import gs://smv-brain-firestore-backups/automatic/RUTA-EXPORT/ `
  --project=smv-brain-dev `
  --database=compras-americanas
```

Verifica conteos y registros críticos después de importar. Una restauración a
producción requiere ventana de mantenimiento, respaldo previo y aprobación
explícita.

## Archivos de Storage

La exportación de Firestore no incluye imágenes ni PDF. Para los objetos de
`ordenes/**`, `pedidos-almacen/**` y `caja-chica/**`, configura versionado o una
política de copia en el bucket real mostrado por Firebase Console:

```powershell
gcloud storage buckets update gs://BUCKET-REAL `
  --versioning `
  --project=smv-brain
```

No asumas que el bucket termina en `.appspot.com`; usa el identificador exacto
del entorno.
