# Contratos de integración — dp-proj-00-03-back

Versión de contrato: **v1** (`X-API-Version: 1`)

## Dependencias

| Servicio | Uso |
|----------|-----|
| Neon PostgreSQL | Datos multi-tenant |
| Firebase / GCS (`FIREBASE_STORAGE_BUCKET`) | Media y plantillas HTML (producción) |
| Front Astro | Webhook `FRONTEND_WEBHOOK_URL` |

## Endpoints expuestos (públicos)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/public/resolve-tenant` | Tenant por hostname |
| GET | `/api/public/templates/{tenantId}/{templateId}` | Plantilla HTML activa |
| GET | `/api/public/templates/{tenantId}/{templateId}/assets/*` | Assets de plantilla |
| GET | `/api/health` | Health check CMS |

## API SaaS (`/api/v1/*`)

Autenticación: `Authorization: Bearer <JWT>` emitido por proveedor registrado en `JWT_EXTERNAL_PROVIDERS`.

Claims esperados: `tenant_id` o `tenants[]` o `role: platform_admin`.

Rate limit: 100 peticiones/minuto por token (429 `RATE_LIMIT_EXCEEDED`).

| Recurso | Operaciones |
|---------|-------------|
| `/api/v1/tenants` | GET, POST |
| `/api/v1/tenants/{id}` | GET, PATCH |
| `/api/v1/tenants/{tenantId}/domains` | GET, POST, GET/PATCH/DELETE por id |
| `/api/v1/tenants/{tenantId}/pages` | GET, POST, GET/PATCH/DELETE por id |
| `/api/v1/tenants/{tenantId}/posts` | GET, POST, GET/PATCH/DELETE por id |

Especificación OpenAPI: [`openapi.yaml`](./openapi.yaml).

## Webhook saliente al front

POST a `FRONTEND_WEBHOOK_URL` con cuerpo JSON `ContentChangeWebhook` y firma `X-Signature-256`.

## Colección `html-templates`

ZIP con `index.html`, `template.manifest.json` y `partials/`, almacenado en `tenants/{tenantId}/templates/{templateId}/`. Campo `templateId` en Pages referencia el slug de la plantilla. Campo `templateData` (JSON) en cada traducción de Pages alimenta los bloques del manifest.
