'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useField, FieldLabel, useFormFields } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'

type FieldDef = {
  type: string
  label?: string
  required?: boolean
  category?: string
  minItems?: number
  maxItems?: number
  itemFields?: Record<string, FieldDef>
  fields?: Record<string, FieldDef>
}

type BlockDef = {
  label: string
  partial: string
  fields: Record<string, FieldDef>
}

type Manifest = {
  version: number
  blocks: Record<string, BlockDef>
}

type AdminFormFields = {
  templateId?: { value?: unknown }
  tenant?: { value?: unknown }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '4px',
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: '6px',
  marginBottom: '12px',
  padding: '12px',
}

function resolveTenantId(tenant: unknown): string | null {
  if (tenant == null) return null
  if (typeof tenant === 'object' && 'id' in tenant) return String((tenant as { id: unknown }).id)
  return String(tenant)
}

function FieldEditor({
  fieldKey,
  def,
  value,
  onChange,
  path,
}: {
  fieldKey: string
  def: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  path: string
}) {
  const label = def.label ?? fieldKey

  if (def.type === 'productCatalog') {
    return (
      <p style={{ fontSize: '13px', color: 'var(--theme-elevation-500)' }}>
        Colección <strong>{def.category}</strong> — carga el catálogo en{' '}
        <em>Contenido → Productos</em> (importar JSON en la lista).
      </p>
    )
  }

  if (def.type === 'productSlugs') {
    const lines = Array.isArray(value)
      ? value.filter((s): s is string => typeof s === 'string').join('\n')
      : ''
    return (
      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
          {label}
        </span>
        <textarea
          style={{ ...inputStyle, minHeight: 72, fontFamily: 'monospace' }}
          placeholder={'demo-mujer-01\ndemo-mujer-02\n(vacío = todos de la categoría)'}
          value={lines}
          onChange={(e) => {
            const slugs = e.target.value
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
            onChange(slugs.length > 0 ? slugs : undefined)
          }}
        />
      </label>
    )
  }

  if (def.type === 'group' && def.fields) {
    const obj = (typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {}) as Record<string, unknown>
    return (
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: '8px' }}>{label}</legend>
        {Object.entries(def.fields).map(([k, sub]) => (
          <div key={k} style={{ marginBottom: '10px' }}>
            <FieldEditor
              fieldKey={k}
              def={sub}
              value={obj[k]}
              onChange={(v) => onChange({ ...obj, [k]: v })}
              path={`${path}.${k}`}
            />
          </div>
        ))}
      </fieldset>
    )
  }

  if (def.type === 'array' && def.itemFields) {
    const items = Array.isArray(value) ? value : []
    const updateItem = (index: number, item: Record<string, unknown>) => {
      const next = [...items]
      next[index] = item
      onChange(next)
    }
    const addItem = () => {
      const empty: Record<string, unknown> = {}
      for (const k of Object.keys(def.itemFields!)) empty[k] = ''
      onChange([...items, empty])
    }
    const removeItem = (index: number) => {
      onChange(items.filter((_, i) => i !== index))
    }

    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>{label}</div>
        {items.map((item, i) => (
          <div
            key={i}
            style={{ ...sectionStyle, background: 'var(--theme-elevation-50)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Ítem {i + 1}</span>
              <button type="button" onClick={() => removeItem(i)}>
                Eliminar
              </button>
            </div>
            {Object.entries(def.itemFields!).map(([k, sub]) => (
              <div key={k} style={{ marginBottom: '8px' }}>
                <FieldEditor
                  fieldKey={k}
                  def={sub}
                  value={(item as Record<string, unknown>)[k]}
                  onChange={(v) =>
                    updateItem(i, { ...(item as Record<string, unknown>), [k]: v })
                  }
                  path={`${path}[${i}].${k}`}
                />
              </div>
            ))}
          </div>
        ))}
        <button type="button" onClick={addItem} style={{ marginTop: '8px' }}>
          + Añadir
        </button>
      </div>
    )
  }

  if (def.type === 'textarea' || def.type === 'richText') {
    return (
      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{label}</span>
        <textarea
          style={{ ...inputStyle, minHeight: def.type === 'richText' ? 120 : 64 }}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    )
  }

  if (def.type === 'image') {
    const mediaId =
      typeof value === 'object' && value !== null && 'mediaId' in value
        ? String((value as { mediaId: unknown }).mediaId ?? '')
        : ''
    return (
      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>{label}</span>
        <input
          style={inputStyle}
          type="number"
          placeholder="ID de Media"
          value={mediaId}
          onChange={(e) =>
            onChange(e.target.value ? { mediaId: e.target.value } : null)
          }
        />
      </label>
    )
  }

  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
        {label}
        {def.required ? ' *' : ''}
      </span>
      <input
        style={inputStyle}
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function JsonImportBar({
  onImport,
  onExport,
  status,
}: {
  onImport: (file: File) => void
  onExport: () => void
  status: string | null
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()}>
          Importar JSON
        </button>
        <button type="button" onClick={onExport}>
          Exportar JSON
        </button>
      </div>
      {status ? (
        <p
          style={{
            fontSize: '13px',
            marginTop: '8px',
            color: status.includes('inválido') || status.includes('debe ser')
              ? 'var(--theme-error-500)'
              : 'var(--theme-elevation-500)',
          }}
        >
          {status}
        </p>
      ) : null}
    </div>
  )
}

export const TemplateDataField: JSONFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<Record<string, Record<string, unknown>> | null>({
    path,
  })
  const templateId = useFormFields(([fields]) => {
    const f = fields as AdminFormFields
    return f.templateId?.value as string | undefined
  })
  const tenant = useFormFields(([fields]) => (fields as AdminFormFields).tenant?.value)

  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tenantId = useMemo(() => resolveTenantId(tenant), [tenant])

  useEffect(() => {
    if (!templateId?.trim() || !tenantId) {
      setManifest(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      'where[tenant][equals]': tenantId,
      'where[templateId][equals]': templateId.trim(),
      'where[status][equals]': 'active',
      limit: '1',
    })

    fetch(`/api/html-templates?${params}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ docs: Array<{ manifest?: Manifest }> }>
      })
      .then((json) => {
        if (cancelled) return
        const doc = json.docs[0]
        if (!doc?.manifest) {
          setManifest(null)
          setError('Plantilla sin manifest. Vuelve a subir el ZIP.')
          return
        }
        setManifest(doc.manifest)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [templateId, tenantId])

  const data = value ?? {}
  const [importStatus, setImportStatus] = useState<string | null>(null)

  const handleImportJson = useCallback(
    (file: File) => {
      setImportStatus(null)
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result)) as unknown
          if (Array.isArray(raw)) {
            setImportStatus(
              'Este archivo es de productos. Impórtalo en Contenido → Productos (lista), no aquí.',
            )
            return
          }
          if (typeof raw !== 'object' || raw === null) {
            setImportStatus('El archivo debe ser un objeto JSON de bloques.')
            return
          }
          const obj = raw as Record<string, unknown>
          if (Array.isArray(obj['products'])) {
            setImportStatus(
              'El array "products" va en Contenido → Productos. Aquí solo template-data (bloques y productSlugs).',
            )
            return
          }

          const blocksSource =
            obj['templateData'] &&
            typeof obj['templateData'] === 'object' &&
            !Array.isArray(obj['templateData'])
              ? (obj['templateData'] as Record<string, unknown>)
              : obj

          const blockIds = manifest?.blocks ? Object.keys(manifest.blocks) : []
          const filtered: Record<string, Record<string, unknown>> = {}
          const skipped: string[] = []

          for (const [key, val] of Object.entries(blocksSource)) {
            if (key === 'products' || key === 'templateData') continue
            if (blockIds.length > 0 && !blockIds.includes(key)) {
              skipped.push(key)
              continue
            }
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
              filtered[key] = val as Record<string, unknown>
            }
          }

          if (Object.keys(filtered).length === 0) {
            setImportStatus('Sin bloques reconocibles en el JSON.')
            return
          }

          setValue({ ...data, ...filtered })
          let msg = `Importados ${Object.keys(filtered).length} bloque(s). Guarda la página.`
          if (skipped.length > 0) {
            msg += ` Omitidos: ${skipped.join(', ')}.`
          }
          setImportStatus(msg)
        } catch {
          setImportStatus('JSON inválido. Usa template-data.example.json.')
        }
      }
      reader.onerror = () => setImportStatus('No se pudo leer el archivo.')
      reader.readAsText(file, 'UTF-8')
    },
    [data, manifest?.blocks, setValue],
  )

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template-data-${templateId ?? 'page'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setImportStatus('JSON exportado.')
  }, [data, templateId])

  const setBlock = useCallback(
    (blockId: string, blockValue: Record<string, unknown>) => {
      setValue({ ...data, [blockId]: blockValue })
    },
    [data, setValue],
  )

  if (!templateId?.trim()) {
    return (
      <div>
        <FieldLabel label={field.label ?? 'Datos de plantilla'} />
        <p style={{ color: 'var(--theme-elevation-500)' }}>
          Indica primero el <strong>templateId</strong> de la página.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <FieldLabel label={field.label ?? 'Datos de plantilla'} />
        <p>Cargando esquema de bloques…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <FieldLabel label={field.label ?? 'Datos de plantilla'} />
        <p style={{ color: 'var(--theme-error-500)' }}>{error}</p>
      </div>
    )
  }

  if (!manifest?.blocks) {
    return (
      <div>
        <FieldLabel label={field.label ?? 'Datos de plantilla'} />
        <p>No hay manifest para esta plantilla.</p>
      </div>
    )
  }

  return (
    <div>
      <FieldLabel label={field.label ?? 'Datos de plantilla (bloques)'} />
      <p style={{ fontSize: '13px', marginBottom: '12px', color: 'var(--theme-elevation-500)' }}>
        Plantilla <code>{templateId}</code> — importa <code>template-data.example.json</code>{' '}
        (textos y <code>productSlugs</code>). El catálogo se carga en{' '}
        <em>Contenido → Productos</em>.
      </p>
      <JsonImportBar
        onImport={handleImportJson}
        onExport={handleExportJson}
        status={importStatus}
      />
      {Object.entries(manifest.blocks).map(([blockId, blockDef]) => {
        if (Object.keys(blockDef.fields).length === 0) {
          return (
            <details key={blockId} style={sectionStyle} open>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{blockDef.label}</summary>
              <p style={{ fontSize: '13px', marginTop: '8px' }}>
                Usa los campos globales <code>title</code> y <code>content</code> de la traducción.
              </p>
            </details>
          )
        }

        const blockValue = data[blockId] ?? {}
        return (
          <details key={blockId} style={sectionStyle} open>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{blockDef.label}</summary>
            <div style={{ marginTop: '12px' }}>
              {Object.entries(blockDef.fields).map(([fieldKey, fieldDef]) => (
                <div key={fieldKey} style={{ marginBottom: '12px' }}>
                  <FieldEditor
                    fieldKey={fieldKey}
                    def={fieldDef}
                    value={blockValue[fieldKey]}
                    onChange={(v) => setBlock(blockId, { ...blockValue, [fieldKey]: v })}
                    path={`${blockId}.${fieldKey}`}
                  />
                </div>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
