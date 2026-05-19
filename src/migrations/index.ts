import * as migration_20260518_195608_initial from './20260518_195608_initial'
import * as migration_20260518_220000_html_templates from './20260518_220000_html_templates'
import * as migration_20260518_230000_html_templates_rels from './20260518_230000_html_templates_rels'

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
]
