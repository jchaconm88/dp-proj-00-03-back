/** Props de imagen responsiva derivadas de un documento Media de Payload (back). */

export const DEFAULT_IMAGE_SIZES =
  '(max-width: 600px) 400px, (max-width: 1200px) 800px, 1600px'

const VARIANT_WIDTHS = { small: 400, medium: 800, large: 1600 } as const

export interface MediaSizeEntry {
  url?: string | null
  width?: number | null
  height?: number | null
}

export interface PayloadMediaLike {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  variants?: {
    small?: string | null
    medium?: string | null
    large?: string | null
  } | null
  sizes?: {
    small?: MediaSizeEntry | null
    medium?: MediaSizeEntry | null
    large?: MediaSizeEntry | null
  } | null
}

export interface MediaImageFields {
  imageUrl: string
  imageSrcset?: string
  imageSizes?: string
  imageWidth?: number
  imageHeight?: number
}

export function toAbsoluteMediaUrl(raw: string, publicBaseUrl: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = publicBaseUrl.replace(/\/$/, '')
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}

function pickVariantUrl(
  doc: PayloadMediaLike,
  variant: keyof typeof VARIANT_WIDTHS,
  publicBaseUrl: string,
): string | null {
  const fromSize = doc.sizes?.[variant]?.url
  if (fromSize) return toAbsoluteMediaUrl(fromSize, publicBaseUrl)

  const fromVariants = doc.variants?.[variant]
  if (fromVariants) return toAbsoluteMediaUrl(fromVariants, publicBaseUrl)

  return null
}

function buildSrcsetFromUrls(entries: Array<{ url: string; width: number }>): string {
  return entries.map(({ url, width }) => `${url} ${width}w`).join(', ')
}

export function buildMediaImageFields(
  doc: PayloadMediaLike,
  publicBaseUrl: string,
): MediaImageFields | null {
  const mediumUrl =
    pickVariantUrl(doc, 'medium', publicBaseUrl) ??
    (doc.url ? toAbsoluteMediaUrl(doc.url, publicBaseUrl) : null)

  if (!mediumUrl) return null

  const srcsetEntries: Array<{ url: string; width: number }> = []
  for (const name of ['small', 'medium', 'large'] as const) {
    const url = pickVariantUrl(doc, name, publicBaseUrl)
    if (url) srcsetEntries.push({ url, width: VARIANT_WIDTHS[name] })
  }

  const mediumSize = doc.sizes?.medium
  const imageWidth = mediumSize?.width ?? doc.width ?? undefined
  const imageHeight = mediumSize?.height ?? doc.height ?? undefined

  return {
    imageUrl: mediumUrl,
    ...(srcsetEntries.length >= 2
      ? { imageSrcset: buildSrcsetFromUrls(srcsetEntries) }
      : {}),
    imageSizes: DEFAULT_IMAGE_SIZES,
    ...(imageWidth != null ? { imageWidth: Number(imageWidth) } : {}),
    ...(imageHeight != null ? { imageHeight: Number(imageHeight) } : {}),
  }
}
