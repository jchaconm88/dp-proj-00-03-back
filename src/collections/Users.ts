import type { CollectionConfig } from 'payload'
import { SESSION_TIMEOUT_HOURS } from '../types/index.ts'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // Tokens expiran a las 24h sin actividad (Req 9.5)
    tokenExpiration: SESSION_TIMEOUT_HOURS * 60 * 60,
    // Cookies de sesion
    cookies: {
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'Lax',
    },
  },
  admin: {
    useAsTitle: 'email',
    group: 'Usuarios',
  },
  // Los usuarios NO son tenant-scoped (best practice del plugin multi-tenant)
  // El aislamiento se hace via la coleccion UserRoles
  access: {
    admin: ({ req }) =>
      Boolean(req.user) &&
      ['platform_admin', 'tenant_admin', 'editor', 'viewer'].includes(req.user?.role ?? ''),
    create: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
    read: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
    update: ({ req, id }) => {
      if (req.user?.role === 'platform_admin') return true
      if (req.user?.role === 'tenant_admin') return true
      // Un usuario puede actualizar su propio perfil
      return req.user?.id === id
    },
    delete: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation === 'update') {
          // Actualizar lastActivity al modificar el usuario
          return { ...data, lastActivity: new Date().toISOString() }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Administrador de Plataforma', value: 'platform_admin' },
        { label: 'Administrador de Tenant', value: 'tenant_admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Visualizador', value: 'viewer' },
      ],
      defaultValue: 'viewer',
      admin: {
        description: 'Rol del usuario (define los permisos en la plataforma)',
      },
    },
    {
      name: 'tenantId',
      type: 'text',
      admin: {
        description: 'ID del tenant al que pertenece (null para platform_admin)',
        readOnly: false,
      },
    },
    {
      name: 'lastActivity',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Última actividad del usuario (para invalidación de sesión a 24h)',
      },
    },
  ],
}
