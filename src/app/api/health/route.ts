/**
 * Liveness para Cloud Run / load balancers — no usa Payload ni Postgres.
 * (El handler en payload.config bajo /health requiere conexión a BD.)
 */
export async function GET(): Promise<Response> {
  return Response.json({
    status: 'ok',
    component: 'cms',
    timestamp: new Date().toISOString(),
  })
}
