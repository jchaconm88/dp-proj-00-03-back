/** Normaliza relaciones Payload (número, string o doc poblado) a string para APIs/webhooks. */
export function refId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return String(value)
}

export function refIdOptional(value: unknown): string | undefined {
  if (value == null) return undefined
  const id = refId(value)
  return id === '' ? undefined : id
}
