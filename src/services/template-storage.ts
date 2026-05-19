import fs from 'node:fs/promises'
import path from 'node:path'
import { createReadStream, existsSync } from 'node:fs'
import AdmZip from 'adm-zip'
import admin from 'firebase-admin'
import { MAX_FILE_SIZE_BYTES } from '../types/index.ts'
import {
  MANIFEST_FILENAME,
  parseTemplateManifestFromBuffer,
  validateZipEntriesAgainstManifest,
  listPartialPaths,
  type TemplateManifest,
} from './template-manifest.ts'

const LOCAL_ROOT =
  process.env['TEMPLATE_STORAGE_ROOT'] ?? path.join(process.cwd(), 'storage', 'templates')
const BUCKET_NAME = process.env['FIREBASE_STORAGE_BUCKET'] ?? ''

export function templatePrefix(tenantId: string, templateId: string): string {
  return `tenants/${tenantId}/templates/${templateId}`
}

function useGcs(): boolean {
  return Boolean(BUCKET_NAME && process.env['NODE_ENV'] === 'production')
}

let gcsInitialized = false

function getGcsBucket(): ReturnType<ReturnType<typeof admin.storage>['bucket']> | null {
  if (!BUCKET_NAME) return null
  if (!gcsInitialized) {
    if (!admin.apps.length) {
      admin.initializeApp({
        storageBucket: BUCKET_NAME,
        projectId: process.env['FIREBASE_PROJECT_ID'],
      })
    }
    gcsInitialized = true
  }
  return admin.storage().bucket(BUCKET_NAME)
}

export function getTemplatePublicBaseUrl(
  serverUrl: string,
  tenantId: string,
  templateId: string,
): string {
  const base = serverUrl.replace(/\/$/, '')
  return `${base}/api/public/templates/${tenantId}/${templateId}/assets`
}

function localDir(tenantId: string, templateId: string): string {
  return path.join(LOCAL_ROOT, templatePrefix(tenantId, templateId))
}

function assertSafeRelativePath(relativePath: string): void {
  const normalized = path.normalize(relativePath).replace(/\\/g, '/')
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid template asset path')
  }
}

export function validateTemplateZip(buffer: Buffer): TemplateManifest {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`El ZIP supera el límite de ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB`)
  }

  const zip = new AdmZip(buffer)
  const entryNames = zip
    .getEntries()
    .filter((e) => !e.isDirectory)
    .map((e) => e.entryName.replace(/\\/g, '/').replace(/^\.\//, ''))

  const manifestEntry = entryNames.find((n) => n === MANIFEST_FILENAME || n.endsWith(`/${MANIFEST_FILENAME}`))
  if (!manifestEntry) {
    throw new Error(`El ZIP debe incluir ${MANIFEST_FILENAME} en la raíz`)
  }

  const manifestBuf = zip.getEntry(manifestEntry)?.getData()
  if (!manifestBuf) {
    throw new Error(`No se pudo leer ${MANIFEST_FILENAME}`)
  }

  const manifest = parseTemplateManifestFromBuffer(manifestBuf)
  validateZipEntriesAgainstManifest(entryNames, manifest)
  return manifest
}

async function writeLocalFile(
  tenantId: string,
  templateId: string,
  relativePath: string,
  data: Buffer,
): Promise<void> {
  assertSafeRelativePath(relativePath)
  const dest = path.join(localDir(tenantId, templateId), relativePath)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, data)
}

async function writeGcsFile(
  tenantId: string,
  templateId: string,
  relativePath: string,
  data: Buffer,
): Promise<void> {
  assertSafeRelativePath(relativePath)
  const bucket = getGcsBucket()
  if (!bucket) throw new Error('GCS bucket no configurado')
  const objectPath = `${templatePrefix(tenantId, templateId)}/${relativePath.replace(/\\/g, '/')}`
  await bucket.file(objectPath).save(data, { resumable: false })
}

export interface UploadBundleResult {
  bundleSizeBytes: number
  manifest: TemplateManifest
}

export async function uploadBundle(
  tenantId: string,
  templateId: string,
  zipBuffer: Buffer,
): Promise<UploadBundleResult> {
  const manifest = validateTemplateZip(zipBuffer)
  await deleteBundle(tenantId, templateId)

  const zip = new AdmZip(zipBuffer)
  let totalBytes = 0

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const relativePath = entry.entryName.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!relativePath) continue
    const data = entry.getData()
    totalBytes += data.length

    if (useGcs()) {
      await writeGcsFile(tenantId, templateId, relativePath, data)
    } else {
      await writeLocalFile(tenantId, templateId, relativePath, data)
    }
  }

  return { bundleSizeBytes: totalBytes, manifest }
}

export async function readManifestFromStorage(
  tenantId: string,
  templateId: string,
): Promise<TemplateManifest | null> {
  const buf = await readFile(tenantId, templateId, MANIFEST_FILENAME)
  if (!buf) return null
  return parseTemplateManifestFromBuffer(buf)
}

export async function readAllPartials(
  tenantId: string,
  templateId: string,
  manifest: TemplateManifest,
): Promise<Record<string, string>> {
  const partials: Record<string, string> = {}
  for (const partialPath of listPartialPaths(manifest)) {
    const buf = await readFile(tenantId, templateId, partialPath)
    if (buf) {
      partials[partialPath] = buf.toString('utf-8')
    }
  }
  return partials
}

export async function readFile(
  tenantId: string,
  templateId: string,
  relativePath: string,
): Promise<Buffer | null> {
  assertSafeRelativePath(relativePath)
  const normalized = relativePath.replace(/\\/g, '/')

  if (useGcs()) {
    const bucket = getGcsBucket()
    if (!bucket) return null
    const objectPath = `${templatePrefix(tenantId, templateId)}/${normalized}`
    const file = bucket.file(objectPath)
    const [exists] = await file.exists()
    if (!exists) return null
    const [contents] = await file.download()
    return contents
  }

  const filePath = path.join(localDir(tenantId, templateId), normalized)
  if (!existsSync(filePath)) return null
  return fs.readFile(filePath)
}

export async function readIndexHtml(tenantId: string, templateId: string): Promise<string | null> {
  let html = await readFile(tenantId, templateId, 'index.html')
  if (html) return html.toString('utf-8')

  const localRoot = localDir(tenantId, templateId)
  if (!useGcs() && existsSync(localRoot)) {
    const entries = await fs.readdir(localRoot, { recursive: true })
    for (const entry of entries) {
      if (typeof entry === 'string' && entry.endsWith('index.html')) {
        const buf = await readFile(tenantId, templateId, entry.replace(/\\/g, '/'))
        if (buf) return buf.toString('utf-8')
      }
    }
  }

  return null
}

export async function deleteBundle(tenantId: string, templateId: string): Promise<void> {
  if (useGcs()) {
    const bucket = getGcsBucket()
    if (!bucket) return
    const prefix = `${templatePrefix(tenantId, templateId)}/`
    const [files] = await bucket.getFiles({ prefix })
    await Promise.all(
      files.map((file: { delete: () => Promise<unknown> }) =>
        file.delete().catch(() => undefined),
      ),
    )
    return
  }

  const dir = localDir(tenantId, templateId)
  if (existsSync(dir)) {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

export function guessContentType(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase()
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
  }
  return map[ext] ?? 'application/octet-stream'
}

export async function createAssetReadStream(
  tenantId: string,
  templateId: string,
  relativePath: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
  assertSafeRelativePath(relativePath)
  const normalized = relativePath.replace(/\\/g, '/')

  if (useGcs()) {
    const bucket = getGcsBucket()
    if (!bucket) return null
    const objectPath = `${templatePrefix(tenantId, templateId)}/${normalized}`
    const file = bucket.file(objectPath)
    const [exists] = await file.exists()
    if (!exists) return null
    return {
      stream: file.createReadStream(),
      contentType: guessContentType(normalized),
    }
  }

  const filePath = path.join(localDir(tenantId, templateId), normalized)
  if (!existsSync(filePath)) return null
  return {
    stream: createReadStream(filePath),
    contentType: guessContentType(normalized),
  }
}
