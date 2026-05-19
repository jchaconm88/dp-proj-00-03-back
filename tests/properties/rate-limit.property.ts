import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { checkV1RateLimit, resetV1RateLimitForTests } from '../../src/endpoints/v1/rate-limit.ts'

/**
 * Property 27: Rate limiting API externa (100 req/min)
 */
describe('Property 27: Rate limiting API v1', () => {
  beforeEach(() => {
    resetV1RateLimitForTests()
  })

  it('permite hasta 100 peticiones y rechaza la 101 para la misma clave', () => {
    fc.assert(
      fc.property(fc.uuid(), (tokenKey) => {
        resetV1RateLimitForTests()
        for (let i = 0; i < 100; i++) {
          expect(checkV1RateLimit(tokenKey)).toBe(true)
        }
        expect(checkV1RateLimit(tokenKey)).toBe(false)
      }),
      { numRuns: 20 },
    )
  })
})
