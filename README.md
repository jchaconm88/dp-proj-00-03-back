# dp-proj-00-03-back

Backend CMS multi-tenant basado en Payload CMS 3.x para la plataforma dp-proj-00-03.

## Tecnología

- **Payload CMS 3.x** — CMS headless con admin panel
- **PostgreSQL (Neon)** — Base de datos con Row Level Security por tenant
- **Firebase Storage** — Almacenamiento de archivos multimedia
- **Cloud Run** — Despliegue serverless en GCP

## Dependencias externas

| Repositorio | Interface consumida | Versión mínima | Protocolo |
|-------------|--------------------|--------------  |-----------|
| dp-proj-00-03-infra | Cloud Run service, Neon outputs | terraform >= 1.6 | GCP APIs |
| dp-proj-00-03-front | Webhook de rebuild (`POST /api/webhooks/rebuild`) | v1 | HTTP POST |

## Contratos de API

Ver [`docs/openapi.yaml`](docs/openapi.yaml) para la especificación completa OpenAPI 3.0.

**Versión del contrato:** v1  
**Base URL:** `https://<CMS_URL>/api`

## Estructura

```
src/
├── payload.config.ts      # Configuración principal de Payload CMS
├── server.ts              # Entry point del servidor
├── collections/           # Colecciones de Payload (modelos de datos)
├── middleware/            # Middleware: RLS, auth, rate limiting
├── services/              # Servicios: notificaciones, scheduler
├── validators/            # Validadores de entrada
├── types/                 # Tipos TypeScript compartidos
└── hooks/                 # Hooks de Payload
tests/
├── properties/            # Property-based tests con fast-check
├── integration/           # Tests de integración
└── unit/                  # Tests unitarios
docs/
└── openapi.yaml           # Especificación OpenAPI 3.0
```

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local
# Editar .env.local con las variables necesarias
pnpm dev
```

## Tests

```bash
pnpm test              # Todos los tests
pnpm test:properties   # Solo property-based tests
pnpm test:integration  # Solo tests de integración
```

## Despliegue

Los pushes a `main` ejecutan: tests → migraciones BD → imagen Docker → Cloud Run.

**Secretos:** solo en GitHub (environment `production`). Ver [`.github/SECRETS.md`](.github/SECRETS.md).
El pipeline inyecta variables en Cloud Run al desplegar; no uses GCP Secret Manager ni metas secretos en la imagen Docker.

```bash
# Build manual (sin secretos en la imagen)
docker build -t cms .
docker run -p 3000:3000 --env-file .env.local cms
```
