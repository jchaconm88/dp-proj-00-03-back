import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { Tenants } from './collections/Tenants.ts'
import { Users } from './collections/Users.ts'
import { Domains } from './collections/Domains.ts'
import { Pages } from './collections/Pages.ts'
import { Posts } from './collections/Posts.ts'
import { Menus } from './collections/Menus.ts'
import { Media } from './collections/Media.ts'
import { ContactSubmissions } from './collections/ContactSubmissions.ts'
import { TenantLanguages } from './collections/TenantLanguages.ts'
import { HtmlTemplates } from './collections/HtmlTemplates.ts'
import { Products } from './collections/Products.ts'
import { publicProductsEndpoint } from './endpoints/publicProducts.ts'
import { adminImportProductsEndpoint } from './endpoints/adminImportProducts.ts'
import { adminImportMenusEndpoint } from './endpoints/adminImportMenus.ts'
import { publicResolveTenantEndpoint } from './endpoints/publicResolveTenant.ts'
import {
  publicTemplateEndpoint,
  publicTemplateAssetEndpoint,
  publicTemplateAssetQueryEndpoint,
} from './endpoints/publicTemplate.ts'
import { v1ApiEndpoints } from './endpoints/v1/index.ts'
import type { Config } from './payload-types.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const serverURL =
  process.env['PAYLOAD_PUBLIC_SERVER_URL'] ??
  `http://localhost:${process.env['PORT'] ?? '3000'}`

const trustedOrigins = [
  serverURL,
  process.env['FRONTEND_URL'] ?? '',
  'http://localhost:4321',
].filter(Boolean)

export default buildConfig({
  serverURL,
  secret: process.env['PAYLOAD_SECRET'] ?? '',

  db: postgresAdapter({
    pool: {
      connectionString: process.env['DATABASE_URL'],
    },
    // Neon: app_user no es owner; el schema se aplica con `pnpm db:migrate` (DATABASE_URL_MIGRATE).
    push: false,
  }),

  editor: lexicalEditor({}),

  plugins: [
    multiTenantPlugin<Config>({
      tenantsSlug: 'tenants',
      userHasAccessToAllTenants: (user) => user.role === 'platform_admin',
      // Los usuarios NO son tenant-scoped (best practice del plugin)
      collections: {
        pages: {},
        posts: {},
        menus: {},
        media: {},
        'contact-submissions': {},
        'tenant-languages': {},
        'html-templates': {},
        products: {},
        domains: {},
      },
    }),
  ],

  collections: [
    Tenants,
    Users,
    Domains,
    Pages,
    Posts,
    Menus,
    Media,
    ContactSubmissions,
    TenantLanguages,
    HtmlTemplates,
    Products,
  ],

  admin: {
    user: 'users',
    meta: {
      titleSuffix: '— dp-proj-00-03 CMS',
    },
  },

  // Endpoints personalizados (ademas de los REST/GraphQL automaticos)
  endpoints: [
    publicResolveTenantEndpoint,
    publicTemplateEndpoint,
    publicTemplateAssetEndpoint,
    publicTemplateAssetQueryEndpoint,
    publicProductsEndpoint,
    adminImportProductsEndpoint,
    adminImportMenusEndpoint,
    ...v1ApiEndpoints,
    {
      path: '/health/ready',
      method: 'get',
      handler: async (req) => {
        try {
          await req.payload.find({
            collection: 'tenants',
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          return Response.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            component: 'cms',
            database: 'connected',
          })
        } catch (error) {
          return Response.json(
            {
              status: 'error',
              component: 'cms',
              database: 'disconnected',
              message: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          )
        }
      },
    },
    {
      path: '/internal/publish-scheduled',
      method: 'post',
      handler: async (req) => {
        // Autenticado por OIDC token del Cloud Scheduler
        const { publishScheduledContent } = await import('./services/scheduler.ts')
        const result = await publishScheduledContent(req.payload)
        return Response.json(result)
      },
    },
  ],

  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },

  graphQL: {
    schemaOutputFile: path.resolve(__dirname, '../docs/schema.graphql'),
  },

  cors: trustedOrigins,

  // Debe incluir la URL del CMS; si no, logout/login fallan (POST sin sesión → 400 No User)
  csrf: trustedOrigins,
})
