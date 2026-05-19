import type { Payload } from 'payload'
import type { Menu } from '../payload-types.ts'

type MenuItem = NonNullable<Menu['items']>[number]

const MENU_LOCATIONS = ['header', 'footer', 'sidebar', 'custom'] as const

export type MenuSeedItem = {
  label: string
  url: string
  sortOrder?: number
  icon?: string
  active?: boolean
}

export type MenuSeed = {
  location: string
  name: string
  items: MenuSeedItem[]
}

export type ImportMenusResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ location: string; message: string }>
}

function mapItems(items: MenuSeedItem[]): MenuItem[] {
  return items.map((item, index) => ({
    label: item.label,
    url: item.url,
    sortOrder: item.sortOrder ?? index,
    icon: item.icon,
    active: item.active ?? false,
  }))
}

function isMenuSeed(value: unknown): value is MenuSeed {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const o = value as Record<string, unknown>
  return (
    typeof o['location'] === 'string' &&
    typeof o['name'] === 'string' &&
    Array.isArray(o['items'])
  )
}

export function parseMenusSeed(raw: unknown): MenuSeed[] {
  let list: unknown[]

  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { menus?: unknown }).menus)) {
    list = (raw as { menus: unknown[] }).menus
  } else {
    throw new Error('menus debe ser un array o { "menus": [...] }')
  }

  const menus: MenuSeed[] = []
  for (const entry of list) {
    if (!isMenuSeed(entry)) {
      throw new Error('Cada menú requiere location, name e items')
    }
    if (!MENU_LOCATIONS.includes(entry.location as (typeof MENU_LOCATIONS)[number])) {
      throw new Error(`Ubicación inválida: ${entry.location}`)
    }
    menus.push(entry)
  }
  return menus
}

export async function upsertMenusForTenant(
  payload: Payload,
  tenantId: string,
  menus: MenuSeed[],
): Promise<ImportMenusResult> {
  const tenantRef = Number(tenantId)
  const result: ImportMenusResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const menu of menus) {
    const location = menu.location.trim()
    try {
      const existing = await payload.find({
        collection: 'menus',
        where: {
          and: [
            { tenant: { equals: tenantRef } },
            { location: { equals: location } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      const data: Omit<Menu, 'id' | 'createdAt' | 'updatedAt'> = {
        tenant: tenantRef,
        name: menu.name,
        location: location as Menu['location'],
        items: mapItems(menu.items),
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'menus',
          id: existing.docs[0]['id'],
          data,
          overrideAccess: true,
        })
        result.updated += 1
      } else {
        await payload.create({
          collection: 'menus',
          data,
          overrideAccess: true,
        })
        result.created += 1
      }
    } catch (err) {
      result.skipped += 1
      result.errors.push({
        location,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
