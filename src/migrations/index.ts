import * as migration_20260518_195608_initial from './20260518_195608_initial'
import * as migration_20260518_220000_html_templates from './20260518_220000_html_templates'
import * as migration_20260518_230000_html_templates_rels from './20260518_230000_html_templates_rels'
import * as migration_20260519_010000_template_manifest from './20260519_010000_template_manifest'
import * as migration_20260519_020000_products from './20260519_020000_products'
import * as migration_20260519_030000_products_locked_rels from './20260519_030000_products_locked_rels'
import * as migration_20260520_000000_menus_flat from './20260520_000000_menus_flat'

export const migrations = [
  {
    up: migration_20260518_195608_initial.up,
    down: migration_20260518_195608_initial.down,
    name: '20260518_195608_initial',
  },
  {
    up: migration_20260518_220000_html_templates.up,
    down: migration_20260518_220000_html_templates.down,
    name: '20260518_220000_html_templates',
  },
  {
    up: migration_20260518_230000_html_templates_rels.up,
    down: migration_20260518_230000_html_templates_rels.down,
    name: '20260518_230000_html_templates_rels',
  },
  {
    up: migration_20260519_010000_template_manifest.up,
    down: migration_20260519_010000_template_manifest.down,
    name: '20260519_010000_template_manifest',
  },
  {
    up: migration_20260519_020000_products.up,
    down: migration_20260519_020000_products.down,
    name: '20260519_020000_products',
  },
  {
    up: migration_20260519_030000_products_locked_rels.up,
    down: migration_20260519_030000_products_locked_rels.down,
    name: '20260519_030000_products_locked_rels',
  },
  {
    up: migration_20260520_000000_menus_flat.up,
    down: migration_20260520_000000_menus_flat.down,
    name: '20260520_000000_menus_flat',
  },
]
