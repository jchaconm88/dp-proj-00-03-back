import type { CollectionConfig } from 'payload'

const validateMenuItemDepth = (items: unknown[], depth = 1): boolean => {
  if (!Array.isArray(items)) return true
  if (depth > 3) return false // max 3 niveles — Property 9

  for (const item of items) {
    const typedItem = item as { children?: unknown[] }
    if (typedItem.children && typedItem.children.length > 0) {
      if (!validateMenuItemDepth(typedItem.children, depth + 1)) return false
    }
  }
  return true
}

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    useAsTitle: 'name',
    group: 'Contenido',
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
    beforeChange: [
      async ({ data }) => {
        const items = data['items'] as unknown[] | undefined
        if (items && !validateMenuItemDepth(items)) {
          throw new Error(
            JSON.stringify([
              { field: 'items', message: 'Los menús no pueden superar 3 niveles de anidamiento' },
            ]),
          )
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'location',
      type: 'select',
      options: [
        { label: 'Encabezado', value: 'header' },
        { label: 'Pie de página', value: 'footer' },
        { label: 'Lateral', value: 'sidebar' },
        { label: 'Personalizado', value: 'custom' },
      ],
      defaultValue: 'header',
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
        { name: 'depth', type: 'number', defaultValue: 1 },
        {
          name: 'children',
          type: 'array',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'url', type: 'text', required: true },
            { name: 'sortOrder', type: 'number', defaultValue: 0 },
            { name: 'depth', type: 'number', defaultValue: 2 },
            {
              name: 'children',
              type: 'array',
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'url', type: 'text', required: true },
                { name: 'sortOrder', type: 'number', defaultValue: 0 },
                { name: 'depth', type: 'number', defaultValue: 3 },
              ],
            },
          ],
        },
      ],
    },
  ],
}
