const windows = new Map<string, { count: number; resetAt: number }>()

/** Rate limit en memoria: 100 req/min por token — Req 16.7 */
export function checkV1RateLimit(tokenKey: string): boolean {
  const now = Date.now()
  const entry = windows.get(tokenKey)

  if (!entry || now > entry.resetAt) {
    windows.set(tokenKey, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 100) return false
  entry.count += 1
  return true
}

export function resetV1RateLimitForTests(): void {
  windows.clear()
}
