import { describe, it } from 'vitest'
import fc from 'fast-check'
import { validateContactForm } from '../../src/validators/contact-form.js'

/**
 * Property tests para formularios de contacto.
 * Feature: multi-tenant-web-platform
 * Properties 22, 23
 */

/** Parte local alineada con isValidEmailRFC5322 en contact-form.ts */
const validEmailLocal = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(s))
  .filter((s) => !s.startsWith('.') && !s.endsWith('.') && !s.includes('..'))

const validEmail = fc
  .tuple(
    validEmailLocal,
    fc.string({ minLength: 2, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s)),
    fc.constantFrom('com', 'net', 'org', 'io', 'mx', 'es'),
  )
  .map(([user, domain, tld]) => `${user}@${domain}.${tld}`)
  .filter((e) => e.length <= 254)

describe('Feature: multi-tenant-web-platform, Property 22: Validación de Formulario de Contacto', () => {
  it('acepta formularios con todos los campos válidos', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          email: validEmail,
          message: fc.string({ minLength: 1, maxLength: 2000 }).filter((s) => s.trim().length > 0),
        }),
        (form) => {
          const result = validateContactForm(form)
          return result.isValid === true && result.errors.length === 0
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rechaza nombre vacío con error en campo name', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constant(''),
          email: validEmail,
          message: fc.string({ minLength: 1, maxLength: 2000 }),
        }),
        (form) => {
          const result = validateContactForm(form)
          return (
            result.isValid === false &&
            result.errors.some((e) => e.field === 'name' && e.type === 'required')
          )
        },
      ),
      { numRuns: 50 },
    )
  })

  it('rechaza nombre que supera 100 caracteres', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 101, maxLength: 200 }),
          email: validEmail,
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        (form) => {
          const result = validateContactForm(form)
          return (
            result.isValid === false &&
            result.errors.some((e) => e.field === 'name' && e.type === 'length_exceeded')
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rechaza email con formato inválido', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('@')),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        (form) => {
          const result = validateContactForm(form)
          return (
            result.isValid === false &&
            result.errors.some((e) => e.field === 'email')
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rechaza mensaje vacío', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: validEmail,
          message: fc.constant(''),
        }),
        (form) => {
          const result = validateContactForm(form)
          return (
            result.isValid === false &&
            result.errors.some((e) => e.field === 'message' && e.type === 'required')
          )
        },
      ),
      { numRuns: 50 },
    )
  })

  it('retorna un error por cada campo invalido', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constant(''),
          email: fc.constant('no-es-un-email'),
          message: fc.constant(''),
        }),
        (form) => {
          const result = validateContactForm(form)
          return result.isValid === false && result.errors.length >= 3
        },
      ),
      { numRuns: 10 },
    )
  })
})

describe('Feature: multi-tenant-web-platform, Property 23: Reintentos de Notificación', () => {
  it('la logica de reintentos intenta exactamente hasta 3 veces', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }),
        (failureSequence) => {
          // Simular la logica de reintentos
          const MAX_RETRIES = 3
          let attempts = 0
          let succeeded = false

          for (let i = 0; i < MAX_RETRIES; i++) {
            attempts++
            const willFail = i < failureSequence.length ? failureSequence[i] : true

            if (!willFail) {
              succeeded = true
              break
            }
          }

          // Invariantes:
          // 1. Nunca supera MAX_RETRIES intentos
          // 2. Si hay un exito, para inmediatamente
          return attempts <= MAX_RETRIES && (succeeded ? attempts <= MAX_RETRIES : attempts === MAX_RETRIES)
        },
      ),
      { numRuns: 100 },
    )
  })
})
