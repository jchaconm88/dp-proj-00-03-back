import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { refId } from '../lib/payload-ids.ts'
import { validateContactForm } from '../validators/contact-form.ts'
import { sendContactNotification } from '../services/notification.ts'

const afterCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return

  // Enviar notificacion al tenant (async, con reintentos)
  const tenantId = doc['tenant']
  if (tenantId != null) {
    const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
    const settings = tenant['settings'] as { contactEmail?: string }
    if (settings.contactEmail) {
      // Ejecutar en background (no bloquear la respuesta al visitante)
      void sendContactNotification({
        submissionId: refId(doc['id']),
        tenantEmail: settings.contactEmail,
        name: doc['name'] as string,
        email: doc['email'] as string,
        message: doc['message'] as string,
        payload: req.payload,
      })
    }
  }
}

export const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  admin: {
    useAsTitle: 'email',
    group: 'Formularios',
    defaultColumns: ['name', 'email', 'notificationStatus', 'submittedAt'],
  },
  access: {
    create: () => true, // Publico (protegido por CAPTCHA en el frontend)
    read: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
    update: ({ req }) => req.user?.role === 'platform_admin',
    delete: ({ req }) => req.user?.role === 'platform_admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (operation !== 'create') return data

        // Validar campos del formulario — Property 22
        const result = validateContactForm({
          name: data['name'] as string ?? '',
          email: data['email'] as string ?? '',
          message: data['message'] as string ?? '',
        })

        if (!result.isValid) {
          throw new Error(JSON.stringify(result.errors))
        }

        return {
          ...data,
          submittedAt: new Date().toISOString(),
          notificationStatus: 'pending',
          retryCount: 0,
        }
      },
    ],
    afterChange: [afterCreate],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 100,
      admin: { description: 'Nombre del remitente (máx 100 caracteres)' },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: { description: 'Email del remitente (máx 254 caracteres, RFC 5322)' },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: { description: 'Mensaje (máx 2000 caracteres)' },
    },
    {
      name: 'notificationStatus',
      type: 'select',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Enviado', value: 'sent' },
        { label: 'Fallido', value: 'failed' },
      ],
      defaultValue: 'pending',
      admin: { readOnly: true },
    },
    {
      name: 'retryCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'submittedAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
}
