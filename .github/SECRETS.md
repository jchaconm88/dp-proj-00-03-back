# Secretos de GitHub (repositorio back)

Fuente única de configuración para **migraciones** y **runtime en Cloud Run**.
Los valores no se guardan en GCP Secret Manager; el pipeline los inyecta al desplegar.

> **No** incluyas secretos en la imagen Docker. Solo se pasan a Cloud Run en el paso `deploy`.

## Infraestructura (CI)

| Secret | Uso |
|--------|-----|
| `GCP_SA_KEY` | JSON de la SA de deploy (ver abajo; **no** uses `dp-proj-00-03-cms@...`) |
| `GCP_PROJECT_ID` | Proyecto GCP del bloque |
| `GCP_REGION` | Región (ej. `us-central1`) |

### `GCP_SA_KEY` (cuenta creada por Terraform)

Tras `terraform apply` / `seed/deploy-block.sh`:

```bash
cd dp-proj-00-03-infra
terraform output -raw ci_deployer_service_account_email
# Ejemplo: dp-proj-00-03-ci-deploy@dp-proj-00-03-a1b2.iam.gserviceaccount.com
```

**Crear la clave JSON manualmente** (Terraform no la genera):

1. GCP Console → IAM → **Cuentas de servicio** → `dp-proj-00-03-ci-deploy@...`
2. Pestaña **Claves** → **Agregar clave** → **JSON**
3. Copiar el contenido del archivo al secret `GCP_SA_KEY` en GitHub

O con gcloud:

```bash
gcloud iam service-accounts keys create ci-deploy-key.json \
  --iam-account="$(terraform output -raw ci_deployer_service_account_email)" \
  --project="$(terraform output -raw gcp_project_id)"
```

Roles ya asignados por infra: Artifact Registry Writer, Cloud Run Admin, Service Account User sobre la SA runtime del CMS.

## Base de datos (job `migrate`)

| Secret | Uso |
|--------|-----|
| `DATABASE_URL_MIGRATE` | Connection string **owner** de Neon (sin pooler). `pnpm db:migrate` + scripts SQL |

Tras `terraform apply` en infra: `terraform output -raw neon_database_owner_connection_string`

## Runtime Cloud Run (job `deploy`)

| Secret | Obligatorio | Uso |
|--------|-------------|-----|
| `DATABASE_URL` | Sí | `app_user` — runtime CMS |
| `PAYLOAD_SECRET` | Sí | Firma de sesiones Payload (≥32 caracteres) |
| `PAYLOAD_PUBLIC_SERVER_URL` | Sí | URL pública del CMS (Cloud Run) |
| `FIREBASE_STORAGE_BUCKET` | Sí | Bucket de media/plantillas |
| `FIREBASE_PROJECT_ID` | Sí | Proyecto Firebase/GCP |
| `RESEND_API_KEY` | No* | Envío de email |
| `TURNSTILE_SECRET_KEY` | No* | CAPTCHA formularios |
| `FRONTEND_WEBHOOK_URL` | No* | Rebuild del front |
| `FRONTEND_WEBHOOK_SECRET` | No* | Firma del webhook |
| `JWT_EXTERNAL_PROVIDERS` | No | JWKS externos |
| `ALERT_EMAIL` | No | Alertas del sistema |

\*Recomendado en producción.

`DATABASE_URL`: `terraform output -raw neon_database_connection_string`

Genera `PAYLOAD_SECRET` una vez (ej. `openssl rand -base64 48`) y reutilízalo entre despliegues.
