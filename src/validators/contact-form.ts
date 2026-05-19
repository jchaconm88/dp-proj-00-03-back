import type { ValidationError } from '../types/index.ts'

export interface ContactFormInput {
  name: string
  email: string
  message: string
}

export interface ContactFormValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Valida los campos de un formulario de contacto.
 * Requisito 8.3, 8.4 — Property 22
 */
export function validateContactForm(input: ContactFormInput): ContactFormValidationResult {
  const errors: ValidationError[] = []

  // Validar nombre
  const name = input.name?.trim() ?? ''
  if (!name) {
    errors.push({ field: 'name', type: 'required', message: 'El nombre es requerido' })
  } else if (name.length > 100) {
    errors.push({
      field: 'name',
      type: 'length_exceeded',
      message: 'El nombre no puede superar 100 caracteres',
    })
  }

  // Validar email (RFC 5322 básico)
  const email = input.email?.trim() ?? ''
  if (!email) {
    errors.push({ field: 'email', type: 'required', message: 'El email es requerido' })
  } else if (email.length > 254) {
    errors.push({
      field: 'email',
      type: 'length_exceeded',
      message: 'El email no puede superar 254 caracteres',
    })
  } else if (!isValidEmailRFC5322(email)) {
    errors.push({ field: 'email', type: 'format', message: 'El formato del email no es válido' })
  }

  // Validar mensaje
  const message = input.message?.trim() ?? ''
  if (!message) {
    errors.push({ field: 'message', type: 'required', message: 'El mensaje es requerido' })
  } else if (message.length > 2000) {
    errors.push({
      field: 'message',
      type: 'length_exceeded',
      message: 'El mensaje no puede superar 2000 caracteres',
    })
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validación de email según RFC 5322 (implementación práctica).
 * No cubre todos los casos del estándar, pero sí los más comunes.
 */
function isValidEmailRFC5322(email: string): boolean {
  // Debe tener exactamente un @
  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === email.length - 1) return false

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (local.length === 0 || local.length > 64) return false
  if (domain.length === 0 || domain.length > 253) return false

  // El dominio debe tener al menos un punto
  if (!domain.includes('.')) return false

  // Validar caracteres básicos del local part
  const localValidChars = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/
  if (!localValidChars.test(local)) return false

  // No puede empezar o terminar con punto
  if (local.startsWith('.') || local.endsWith('.')) return false
  if (local.includes('..')) return false

  return true
}
