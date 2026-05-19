import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { notifyContentChange } from '../../src/services/webhook.ts'

describe('Webhook al frontend', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env['FRONTEND_WEBHOOK_URL'] = 'http://localhost:4321/api/webhooks/rebuild'
    process.env['FRONTEND_WEBHOOK_SECRET'] = 'test-webhook-secret'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('envía evento content.published con firma HMAC', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    globalThis.fetch = vi.fn(async (url, init) => {
      capturedUrl = String(url)
      capturedInit = init
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch

    await notifyContentChange({
      event: 'content.published',
      tenantId: 'tenant-42',
      collection: 'pages',
      documentId: 'page-99',
      timestamp: new Date().toISOString(),
    })

    expect(capturedUrl).toBe('http://localhost:4321/api/webhooks/rebuild')
    expect(capturedInit?.method).toBe('POST')

    const body = String(capturedInit?.body)
    const signature = (capturedInit?.headers as Record<string, string>)['X-Signature-256']
    const expected = `sha256=${crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(body)
      .digest('hex')}`

    expect(signature).toBe(expected)
    expect(JSON.parse(body)).toMatchObject({
      event: 'content.published',
      tenantId: 'tenant-42',
      collection: 'pages',
      documentId: 'page-99',
    })
  })

  it('no falla si FRONTEND_WEBHOOK_URL no está configurada', async () => {
    delete process.env['FRONTEND_WEBHOOK_URL']
    globalThis.fetch = vi.fn() as typeof fetch

    await expect(
      notifyContentChange({
        event: 'content.updated',
        tenantId: 't1',
        collection: 'html-templates',
        documentId: 'tpl-1',
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined()

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
