import type { CollectionConfig } from 'payload'

export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    useAsTitle: 'name',
    group: 'Contenido',
    defaultColumns: ['name', 'location'],
    components: {
      beforeListTable: ['@/components/admin/MenusImportPanel#MenusImportPanel'],
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
      labels: { singular: 'Enlace', plural: 'Enlaces' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
        { name: 'icon', type: 'text', admin: { description: 'Material Symbols (ej. woman, home)' } },
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Enlace activo en la navegación' },
        },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
      ],
    },
  ],
}
