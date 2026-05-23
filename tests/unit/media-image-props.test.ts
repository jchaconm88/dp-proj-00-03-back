import { describe, it, expect } from 'vitest'
import { buildMediaImageFields } from '../../src/lib/media-image-props.ts'

describe('buildMediaImageFields', () => {
  it('usa medium como imageUrl y construye srcset', () => {
    const fields = buildMediaImageFields(
      {
        url: '/media/p.webp',
        sizes: {
          small: { url: '/media/p-small.webp', width: 400 },
          medium: { url: '/media/p-medium.webp', width: 800, height: 400 },
          large: { url: '/media/p-large.webp', width: 1600 },
        },
      },
      'https://cms.example.com',
    )

    expect(fields?.imageUrl).toBe('https://cms.example.com/media/p-medium.webp')
    expect(fields?.imageSrcset).toContain('400w')
    expect(fields?.imageWidth).toBe(800)
    expect(fields?.imageHeight).toBe(400)
  })
})
