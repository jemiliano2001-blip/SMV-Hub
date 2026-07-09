#!/usr/bin/env bash
# Configura exportación diaria de Firestore → Cloud Storage con retención 90 días.
# Requiere: gcloud CLI autenticado con permisos de Owner o roles:
#   - roles/datastore.importExportAdmin
#   - roles/storage.admin
#   - roles/cloudscheduler.admin
#   - roles/run.invoker (si usa Cloud Run)
#
# Uso:
#   ./infra/firestore-backup/setup.sh
#   ./infra/firestore-backup/setup.sh --project smv-brain --database compras-americanas

set -euo pipefail

PROJECT_ID="smv-brain"
DATABASE_ID="compras-americanas"
BUCKET_NAME="${PROJECT_ID}-firestore-backups"
LOCATION="us-central1"
SCHEDULER_JOB="firestore-daily-export"
SERVICE_ACCOUNT="firestore-backup@${PROJECT_ID}.iam.gserviceaccount.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --database) DATABASE_ID="$2"; shift 2 ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

BUCKET_NAME="${PROJECT_ID}-firestore-backups"
SERVICE_ACCOUNT="firestore-backup@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Proyecto: ${PROJECT_ID}, base: ${DATABASE_ID}"

echo "==> Crear bucket de backups (si no existe)"
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${LOCATION}" \
    --uniform-bucket-level-access
fi

echo "==> Política de ciclo de vida (90 días)"
cat > /tmp/lifecycle.json <<'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 90 }
    }
  ]
}
EOF
gcloud storage buckets update "gs://${BUCKET_NAME}" \
  --lifecycle-file=/tmp/lifecycle.json \
  --project="${PROJECT_ID}"

echo "==> Cuenta de servicio para exportaciones"
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud iam service-accounts create firestore-backup \
    --display-name="Firestore scheduled export" \
    --project="${PROJECT_ID}"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None \
  --quiet

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin" \
  --project="${PROJECT_ID}" \
  --quiet

echo "==> Cloud Scheduler (export diario 02:00 America/Monterrey)"
EXPORT_URI="gs://${BUCKET_NAME}/automatic/\$(date +%Y-%m-%d)"

# Cloud Scheduler invoca la API de Firestore export vía OAuth del SA
gcloud scheduler jobs delete "${SCHEDULER_JOB}" \
  --project="${PROJECT_ID}" \
  --location="${LOCATION}" \
  --quiet 2>/dev/null || true

gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
  --project="${PROJECT_ID}" \
  --location="${LOCATION}" \
  --schedule="0 2 * * *" \
  --time-zone="America/Monterrey" \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}:exportDocuments" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body="{\"outputUriPrefix\":\"gs://${BUCKET_NAME}/automatic/\"}" \
  --oauth-service-account-email="${SERVICE_ACCOUNT}" \
  --oauth-token-scope="https://www.googleapis.com/auth/datastore"

echo ""
echo "Listo. Verifica en GCP Console:"
echo "  - Cloud Storage: gs://${BUCKET_NAME}"
echo "  - Cloud Scheduler: ${SCHEDULER_JOB}"
echo ""
echo "Restauración (manual, requiere ventana de mantenimiento):"
echo "  gcloud firestore import gs://${BUCKET_NAME}/automatic/YYYY-MM-DD/ \\"
echo "    --project=${PROJECT_ID} --database=${DATABASE_ID}"
