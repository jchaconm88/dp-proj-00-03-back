'use client'

import React, { useCallback, useState } from 'react'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'

export const ProductsImportPanel: React.FC = () => {
  const { selectedTenantID } = useTenantSelection()
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const tenantId =
    selectedTenantID != null && selectedTenantID !== ''
      ? String(selectedTenantID)
      : null

  const handleFile = useCallback(
    (file: File) => {
      if (!tenantId) {
        setStatus('Selecciona un tenant en el selector superior antes de importar.')
        return
      }

      setBusy(true)
      setStatus(null)
      const reader = new FileReader()
      reader.onload = () => {
        void (async () => {
          try {
            let products: unknown
            const parsed = JSON.parse(String(reader.result)) as unknown
            if (Array.isArray(parsed)) {
              products = parsed
            } else if (
              typeof parsed === 'object' &&
              parsed !== null &&
              Array.isArray((parsed as { products?: unknown }).products)
            ) {
              products = (parsed as { products: unknown[] }).products
            } else {
              setStatus('Formato inválido: array de productos o { "products": [...] }.')
              return
            }

            const res = await fetch('/api/admin/import-products', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tenantId, products }),
            })
            const json = (await res.json()) as {
              error?: string
              created?: number
              updated?: number
              errors?: Array<{ slug: string; message: string }>
            }
            if (!res.ok) {
              setStatus(json.error ?? `Error HTTP ${res.status}`)
              return
            }
            let msg = `${json.created ?? 0} creados, ${json.updated ?? 0} actualizados (upsert por slug).`
            if ((json.errors?.length ?? 0) > 0) {
              msg += ` ${json.errors!.length} con error.`
            }
            msg += ' Recarga la lista si no ves los cambios.'
            setStatus(msg)
          } catch {
            setStatus('JSON inválido. Usa products.example.json del paquete de plantilla.')
          } finally {
            setBusy(false)
          }
        })()
      }
      reader.onerror = () => {
        setStatus('No se pudo leer el archivo.')
        setBusy(false)
      }
      reader.readAsText(file, 'UTF-8')
    },
    [tenantId],
  )

  return (
    <div
      style={{
        marginBottom: 'var(--base)',
        padding: '12px 16px',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '6px',
        background: 'var(--theme-elevation-50)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <strong style={{ fontSize: '14px' }}>Importar catálogo JSON</strong>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Importando…' : 'Elegir archivo'}
        </button>
        <span style={{ fontSize: '13px', color: 'var(--theme-elevation-500)' }}>
          Ej. <code>products.example.json</code> — upsert por <code>slug</code> y categoría.
        </span>
      </div>
      {status ? (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '13px',
            color: status.includes('inválido') || status.includes('Selecciona')
              ? 'var(--theme-error-500)'
              : 'var(--theme-elevation-600)',
          }}
        >
          {status}
        </p>
      ) : null}
    </div>
  )
}
