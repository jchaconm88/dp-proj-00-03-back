import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { validateRFC1123Hostname } from '../validators/domain.ts'
import { MAX_DOMAINS_PER_TENANT } from '../types/index.ts'
import { randomBytes } from 'crypto'

const validateDomainBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  const hostname: string = (data['hostname'] as string | undefined)?.toLowerCase().trim() ?? ''

  if (!validateRFC1123Hostname(hostname)) {
    throw new Error(
      JSON.stringify([
        {
          field: 'hostname',
          message: `El hostname '${hostname}' no es válido según RFC 1123`,
        },
      ]),
    )
  }

  // Verificar que no esté asociado a otro tenant
  const tenantId = data['tenant'] ?? data['tenantId']
  const existing = await req.payload.find({
    collection: 'domains',
    where: {
      and: [
        { hostname: { equals: hostname } },
        ...(operation === 'update' ? [{ id: { not_equals: data['id'] } }] : []),
      ],
    },
    limit: 1,
  })

  if (existing.totalDocs > 0) {
    throw new Error(
      JSON.stringify([
        {
          field: 'hostname',
          message: `El dominio '${hostname}' ya está asociado a otro tenant`,
        },
      ]),
    )
  }

  // Verificar limite de dominios por tenant (max 10)
  if (operation === 'create') {
    const tenantDomains = await req.payload.find({
      collection: 'domains',
      where: { tenant: { equals: tenantId } },
    })

    if (tenantDomains.totalDocs >= MAX_DOMAINS_PER_TENANT) {
      throw new Error(
        JSON.stringify([
          {
            field: 'hostname',
            message: `El tenant ya tiene el máximo de ${MAX_DOMAINS_PER_TENANT} dominios`,
          },
        ]),
      )
    }
  }

  // Generar token de verificacion al crear
  if (operation === 'create') {
    const verificationToken = `dp-proj-verify=${randomBytes(20).toString('hex')}`
    const verificationDeadline = new Date(
      Date.now() + 72 * 60 * 60 * 1000, // 72 horas
    ).toISOString()

    return {
      ...data,
      hostname,
      verificationToken,
      verificationDeadline,
      status: 'pending',
      sslProvisioned: false,
    }
  }

  return { ...data, hostname }
}

export const Domains: CollectionConfig = {
  slug: 'domains',
  admin: {
    useAsTitle: 'hostname',
    group: 'Tenants',
  },
  access: {
    create: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
    read: () => true,
    update: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
    delete: ({ req }) =>
      req.user?.role === 'platform_admin' || req.user?.role === 'tenant_admin',
  },
  hooks: {
    beforeChange: [validateDomainBeforeChange],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (doc['status'] === 'verified' && operation === 'update') {
          // Configurar SSL via Firebase Hosting API (en la implementacion real)
          req.payload.logger.info({
            msg: 'Dominio verificado, iniciando provision SSL',
            domain: doc['hostname'],
            tenantId: doc['tenant'],
          })
        }

        if (doc['status'] === 'active' || doc['status'] === 'failed') {
          // Notificar al frontend para actualizar cache de resolucion de dominios
          const { notifyFrontendDomainChange } = await import('../services/webhook.ts')
          await notifyFrontendDomainChange(doc['hostname'] as string)
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        req.payload.logger.info({
          msg: 'Dominio eliminado',
          domain: doc['hostname'],
          tenantId: doc['tenant'],
        })
        const { notifyFrontendDomainChange } = await import('../services/webhook.ts')
        await notifyFrontendDomainChange(doc['hostname'] as string)
      },
    ],
  },
  fields: [
    {
      name: 'hostname',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Nombre de dominio completo (ej: www.mi-empresa.com)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente de verificación', value: 'pending' },
        { label: 'Verificado', value: 'verified' },
        { label: 'Activo', value: 'active' },
        { label: 'Fallido', value: 'failed' },
        { label: 'Cancelado', value: 'cancelled' },
      ],
    },
    {
      name: 'verificationToken',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Token DNS TXT para verificar propiedad del dominio',
      },
    },
    {
      name: 'verificationDeadline',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Fecha límite para completar la verificación (72h desde el registro)',
      },
    },
    {
      name: 'sslProvisioned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'SSL provisionado via Firebase Hosting',
      },
    },
  ],
}
