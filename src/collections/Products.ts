import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { refId } from '../lib/payload-ids.ts'
import { notifyContentChange } from '../services/webhook.ts'

const PRODUCT_CATEGORIES = [
  { label: 'Mujer', value: 'mujer' },
  { label: 'Hombre', value: 'hombre' },
  { label: 'Hogar y otros', value: 'hogar' },
  { label: 'Liquidación', value: 'liquidacion' },
] as const

const afterChangeWebhook: CollectionAfterChangeHook = async ({ doc, operation }) => {
  const event =
    operation === 'create'
      ? 'content.created'
      : doc['status'] === 'published'
        ? 'content.published'
        : 'content.updated'

  await notifyContentChange({
    event,
    tenantId: refId(doc['tenant']),
    collection: 'products',
    documentId: refId(doc['id']),
    timestamp: new Date().toISOString(),
  })
}

const afterDeleteWebhook: CollectionAfterDeleteHook = async ({ doc }) => {
  await notifyContentChange({
    event: 'content.updated',
    tenantId: refId(doc['tenant']),
    collection: 'products',
    documentId: refId(doc['id']),
    timestamp: new Date().toISOString(),
  })
}

export const Products: CollectionConfig = {
  slug: 'products',
  labels: {
    singular: 'Producto',
    plural: 'Productos',
  },
  admin: {
    useAsTitle: 'title',
    group: 'Contenido',
    defaultColumns: ['title', 'slug', 'category', 'price', 'status', 'sortOrder'],
    components: {
      beforeListTable: ['@/components/admin/ProductsImportPanel#ProductsImportPanel'],
    },
  },
  access: {
    create: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    read: () => true,
    update: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    delete: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
  },
  hooks: {
    afterChange: [afterChangeWebhook],
    afterDelete: [afterDeleteWebhook],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      admin: { description: 'Identificador opcional (SKU o slug)' },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [...PRODUCT_CATEGORIES],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'published',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Publicado', value: 'published' },
      ],
    },
    {
      name: 'price',
      type: 'text',
      required: true,
      admin: { description: 'Ej. S/80.00' },
    },
    {
      name: 'oldPrice',
      type: 'text',
      admin: { description: 'Precio tachado (liquidación)' },
    },
    {
      name: 'badge',
      type: 'text',
      admin: { description: 'Ej. 2×150, Oferta, -50%' },
    },
    {
      name: 'emoji',
      type: 'text',
      admin: { description: 'Emoji o icono visual (👟)' },
    },
    {
      name: 'ctaLabel',
      type: 'text',
      defaultValue: 'Seleccionar opciones',
    },
    {
      name: 'href',
      type: 'text',
      admin: { description: 'Enlace del producto (#mujer o URL)' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}

export const PRODUCT_CATEGORY_VALUES = PRODUCT_CATEGORIES.map((c) => c.value)
