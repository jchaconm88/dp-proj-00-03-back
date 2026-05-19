import type { BasePayload } from 'payload'

/**
 * Publica automaticamente el contenido programado cuya fecha ya paso.
 * Llamado cada minuto por Cloud Scheduler.
 * Requisito 4.3, 4.7 — tolerancia maxima de 5 minutos
 */
export async function publishScheduledContent(payload: BasePayload): Promise<{
  published: number
  failed: number
  errors: string[]
}> {
  const now = new Date().toISOString()
  const results = { published: 0, failed: 0, errors: [] as string[] }

  // Buscar pages programadas cuya fecha ya paso
  const scheduledPages = await payload.find({
    collection: 'pages',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { scheduledDate: { less_than_equal: now } },
      ],
    },
    limit: 100,
  })

  for (const page of scheduledPages.docs) {
    try {
      await payload.update({
        collection: 'pages',
        id: page['id'],
        data: {
          status: 'published',
          publishDate: now,
        },
      })
      results.published++
    } catch (error) {
      const errMsg = `pages:${String(page['id'])}: ${error instanceof Error ? error.message : String(error)}`
      results.errors.push(errMsg)
      results.failed++

      // Notificar al editor sobre el fallo — Req 4.7
      payload.logger.error({
        msg: 'Fallo en publicacion programada de pagina',
        pageId: page['id'],
        tenantId: page['tenant'],
        scheduledDate: page['scheduledDate'],
        error: error instanceof Error ? error.message : String(error),
        severity: 'ERROR',
        event: 'scheduled_publish_failed',
      })
    }
  }

  // Buscar posts programados
  const scheduledPosts = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { status: { equals: 'scheduled' } },
        { scheduledDate: { less_than_equal: now } },
      ],
    },
    limit: 100,
  })

  for (const post of scheduledPosts.docs) {
    try {
      await payload.update({
        collection: 'posts',
        id: post['id'],
        data: {
          status: 'published',
          publishDate: now,
        },
      })
      results.published++
    } catch (error) {
      const errMsg = `posts:${String(post['id'])}: ${error instanceof Error ? error.message : String(error)}`
      results.errors.push(errMsg)
      results.failed++

      payload.logger.error({
        msg: 'Fallo en publicacion programada de post',
        postId: post['id'],
        tenantId: post['tenant'],
        scheduledDate: post['scheduledDate'],
        error: error instanceof Error ? error.message : String(error),
        severity: 'ERROR',
        event: 'scheduled_publish_failed',
      })
    }
  }

  payload.logger.info({
    msg: 'Ciclo de publicacion programada completado',
    published: results.published,
    failed: results.failed,
    timestamp: now,
  })

  return results
}
