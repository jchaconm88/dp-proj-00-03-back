// Tipos compartidos entre backend y frontend
// Contrato de API v1 — dp-proj-00-03-back

export interface Tenant {
  id: string
  name: string
  defaultLanguage: string
  timezone: string
  isActive: boolean
  settings: TenantSettings
  createdAt: string
  updatedAt: string
}

export interface TenantSettings {
  contactEmail: string
  maxStorageBytes: number // default: 5 * 1024 * 1024 * 1024 (5GB)
  currentStorageBytes: number
  captchaEnabled: boolean
  frontendWebhookUrl?: string
}

export interface Domain {
  id: string
  tenantId: string
  hostname: string
  status: 'pending' | 'verified' | 'active' | 'failed' | 'cancelled'
  verificationToken: string
  verificationDeadline: string
  sslProvisioned: boolean
  createdAt: string
}

export interface UserRole {
  userId: string
  tenantId: string
  role: 'platform_admin' | 'tenant_admin' | 'editor' | 'viewer'
}

export interface Page {
  id: string
  tenantId: string
  slug: string
  status: ContentStatus
  pageType: 'static' | 'landing'
  publishDate: string | null
  scheduledDate: string | null
  hasSchemaOrg: boolean
  seoConfig: SEOConfig
  translations: PageTranslation[]
  createdAt: string
  updatedAt: string
}

export interface PageTranslation {
  id: string
  pageId: string
  languageCode: string
  title: string
  content: string
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
}

export interface Post {
  id: string
  tenantId: string
  slug: string
  status: ContentStatus
  publishDate: string | null
  scheduledDate: string | null
  seoConfig: SEOConfig
  translations: PostTranslation[]
  createdAt: string
  updatedAt: string
}

export interface PostTranslation {
  id: string
  postId: string
  languageCode: string
  title: string
  content: string
  excerpt: string
  metaTitle: string | null
  metaDescription: string | null
}

export type ContentStatus = 'draft' | 'scheduled' | 'published'

export interface SEOConfig {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImage: string | null
}

export interface Menu {
  id: string
  tenantId: string
  name: string
  location: string
  items: MenuItem[]
  createdAt: string
}

export interface MenuItem {
  id: string
  menuId: string
  parentId: string | null
  label: string
  url: string
  sortOrder: number
  depth: number // max 3
  children: MenuItem[]
}

export interface MediaFile {
  id: string
  tenantId: string
  filename: string
  mimeType: AllowedMimeType
  fileSize: number
  storagePath: string
  altText: string | null
  variants: ImageVariants | null
  createdAt: string
}

export interface ImageVariants {
  small: string
  medium: string
  large: string
}

export interface ContactSubmission {
  id: string
  tenantId: string
  name: string
  email: string
  message: string
  notificationStatus: 'pending' | 'sent' | 'failed'
  retryCount: number
  submittedAt: string
}

export interface TenantLanguage {
  id: string
  tenantId: string
  languageCode: string
  isPrimary: boolean
}

export type AllowedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/svg+xml'
  | 'image/gif'
  | 'application/pdf'
  | 'video/mp4'

export const ALLOWED_MIME_TYPES: AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'application/pdf',
  'video/mp4',
]

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_STORAGE_PER_TENANT_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB
export const MAX_DOMAINS_PER_TENANT = 10
export const DOMAIN_VERIFICATION_TIMEOUT_HOURS = 72
export const SESSION_TIMEOUT_HOURS = 24
export const MAX_LANGUAGES_PER_TENANT = 20
export const MIN_LANGUAGES_PER_TENANT = 2

// Tipos de error de la API
export interface ApiError {
  code: string
  message: string
  field?: string
}

export interface ValidationError {
  field: string
  type: 'required' | 'format' | 'length_exceeded' | 'duplicate' | 'invalid'
  message: string
}

// Webhook de cambio de contenido (enviado al frontend)
export interface ContentChangeWebhook {
  event: 'content.created' | 'content.updated' | 'content.published' | 'content.unpublished'
  tenantId: string
  collection: string
  documentId: string
  timestamp: string
}
