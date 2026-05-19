import type { Endpoint } from 'payload'
import {
  getTemplatePublicBaseUrl,
  readIndexHtml,
  createAssetReadStream,
  guessContentType,
} from '../services/template-storage.ts'

const CACHE_MAX_AGE = 86400 // 24h mínimo — Req 6.4

async function findActiveTemplate(
  payload: import('payload').Payload,
  tenantId: string,
  templateId: string,
) {
  const result = await payload.find({
    collection: 'html-templates',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { templateId: { equals: templateId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

export const publicTemplateEndpoint: Endpoint = {
  path: '/public/templates/:tenantId/:templateId',
  method: 'get',
  handler: async (req) => {
    const tenantId = req.routeParams?.['tenantId'] as string
    const templateId = req.routeParams?.['templateId'] as string

    if (!tenantId || !templateId) {
      return Response.json({ error: 'tenantId and templateId are required' }, { status: 400 })
    }

    const template = await findActiveTemplate(req.payload, tenantId, templateId)
    if (!template) {
      return Response.json({ error: 'template not found' }, { status: 404 })
    }

    const html = await readIndexHtml(tenantId, templateId)
    if (!html) {
      return Response.json({ error: 'index.html not found in template bundle' }, { status: 404 })
    }

    const serverUrl =
      process.env['PAYLOAD_PUBLIC_SERVER_URL'] ??
      `http://localhost:${process.env['PORT'] ?? '3000'}`

    return Response.json({
      html,
      baseUrl: getTemplatePublicBaseUrl(serverUrl, tenantId, templateId),
      templateId,
      tenantId,
    })
  },
}

export const publicTemplateAssetEndpoint: Endpoint = {
  path: '/public/templates/:tenantId/:templateId/assets',
  method: 'get',
  handler: async (req) => {
    const tenantId = req.routeParams?.['tenantId'] as string
    const templateId = req.routeParams?.['templateId'] as string

    if (!tenantId || !templateId) {
      return Response.json({ error: 'tenantId and templateId are required' }, { status: 400 })
    }

    const url = new URL(req.url ?? 'http://localhost', 'http://localhost')
    const prefix = `/api/public/templates/${tenantId}/${templateId}/assets/`
    const pathname = url.pathname
    let assetPath = ''

    if (pathname.includes('/assets/')) {
      assetPath = decodeURIComponent(pathname.split('/assets/')[1] ?? '')
    } else {
      assetPath = url.searchParams.get('path') ?? ''
    }

    if (!assetPath) {
      return Response.json({ error: 'asset path is required' }, { status: 400 })
    }

    const template = await findActiveTemplate(req.payload, tenantId, templateId)
    if (!template) {
      return Response.json({ error: 'template not found' }, { status: 404 })
    }

    const asset = await createAssetReadStream(tenantId, templateId, assetPath)
    if (!asset) {
      return Response.json({ error: 'asset not found' }, { status: 404 })
    }

    const chunks: Buffer[] = []
    for await (const chunk of asset.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType ?? guessContentType(assetPath),
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    })
  },
}
