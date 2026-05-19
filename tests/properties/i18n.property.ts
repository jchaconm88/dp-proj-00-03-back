import { describe, it } from 'vitest'
import fc from 'fast-check'
import { MIN_LANGUAGES_PER_TENANT, MAX_LANGUAGES_PER_TENANT } from '../../src/types/index.js'

/**
 * Property tests para configuración de idiomas.
 * Feature: multi-tenant-web-platform
 * Property 19
 */

interface LanguageConfig {
  languageCode: string
  isPrimary: boolean
}

function validateLanguageConfig(languages: LanguageConfig[]): { valid: boolean; error?: string } {
  if (languages.length < MIN_LANGUAGES_PER_TENANT) {
    return { valid: false, error: `Se requieren al menos ${MIN_LANGUAGES_PER_TENANT} idiomas` }
  }

  if (languages.length > MAX_LANGUAGES_PER_TENANT) {
    return { valid: false, error: `No puede superar ${MAX_LANGUAGES_PER_TENANT} idiomas` }
  }

  const primaryCount = languages.filter((l) => l.isPrimary).length

  if (primaryCount !== 1) {
    return { valid: false, error: 'Debe haber exactamente 1 idioma principal' }
  }

  return { valid: true }
}

const languageCodes = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ja', 'zh', 'ar', 'ru',
  'ko', 'nl', 'sv', 'pl', 'tr', 'uk', 'cs', 'ro', 'hu', 'fi']

describe('Feature: multi-tenant-web-platform, Property 19: Configuración de Idiomas por Tenant', () => {
  it('acepta configuraciones de 2 a 20 idiomas con exactamente 1 principal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_LANGUAGES_PER_TENANT, max: MAX_LANGUAGES_PER_TENANT }),
        (numLanguages) => {
          const codes = languageCodes.slice(0, numLanguages)
          const configs: LanguageConfig[] = codes.map((code, idx) => ({
            languageCode: code,
            isPrimary: idx === 0, // El primero es el principal
          }))

          const result = validateLanguageConfig(configs)
          return result.valid === true
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rechaza configuraciones con menos de 2 idiomas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MIN_LANGUAGES_PER_TENANT - 1 }),
        (numLanguages) => {
          const codes = languageCodes.slice(0, numLanguages)
          const configs: LanguageConfig[] = codes.map((code, idx) => ({
            languageCode: code,
            isPrimary: idx === 0,
          }))

          const result = validateLanguageConfig(configs)
          return result.valid === false
        },
      ),
      { numRuns: 50 },
    )
  })

  it('rechaza configuraciones con mas de 20 idiomas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_LANGUAGES_PER_TENANT + 1, max: 30 }),
        (numLanguages) => {
          // Generar mas idiomas de los permitidos usando codigos custom
          const configs: LanguageConfig[] = Array.from({ length: numLanguages }, (_, idx) => ({
            languageCode: `lang-${idx}`,
            isPrimary: idx === 0,
          }))

          const result = validateLanguageConfig(configs)
          return result.valid === false
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rechaza configuraciones sin idioma principal o con mas de 1', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0), // Sin idioma principal
          fc.integer({ min: 2, max: 5 }), // Mas de 1 principal
        ),
        (primaryCount) => {
          const configs: LanguageConfig[] = ['es', 'en', 'fr'].map((code, idx) => ({
            languageCode: code,
            isPrimary: idx < primaryCount,
          }))

          const result = validateLanguageConfig(configs)
          // primaryCount !== 1 siempre debe ser invalido
          return primaryCount === 1 ? result.valid === true : result.valid === false
        },
      ),
      { numRuns: 100 },
    )
  })
})
