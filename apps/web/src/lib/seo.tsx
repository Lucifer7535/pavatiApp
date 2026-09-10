import { useEffect } from 'react'

const SITE_URL = 'https://pavatipustak.app'
const SITE_NAME = 'Pāvati Pustak'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(data: object) {
  const id = 'seo-jsonld'
  let el = document.head.querySelector<HTMLScriptElement>(`script[type="application/ld+json"]#${id}`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function removeJsonLd() {
  document.head.querySelector<HTMLScriptElement>('#seo-jsonld')?.remove()
}

function buildOgImage(url: string | null | undefined) {
  if (!url) return `${SITE_URL}/logo.png`
  return url.startsWith('http') ? url : `${SITE_URL}${url}`
}

interface SeoProps {
  title?: string
  description?: string
  path?: string
  image?: string | null
  type?: string
  noindex?: boolean
  jsonLd?: object
}

export const DEFAULTS = {
  title: 'Pāvati Pustak — Digital Trust, Receipt & Donation Management',
  description:
    'Digital trust and donation management. Create festive pāvati receipts, collect donations online and offline, verify receipts instantly, and keep your trust accounts transparent.',
  path: '/',
  image: `${SITE_URL}/logo.png`,
  type: 'website',
}

export function Seo({ title, description, path, image, type, noindex, jsonLd }: SeoProps) {
  useEffect(() => {
    const t = title ?? DEFAULTS.title
    const d = description ?? DEFAULTS.description
    const url = `${SITE_URL}${path ?? DEFAULTS.path}`
    const img = buildOgImage(image ?? DEFAULTS.image)
    const ogType = type ?? DEFAULTS.type

    document.title = t
    upsertMeta('name', 'description', d)
    upsertLink('canonical', url)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:title', t)
    upsertMeta('property', 'og:description', d)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', img)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', t)
    upsertMeta('name', 'twitter:description', d)
    upsertMeta('name', 'twitter:image', img)

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow')
    } else {
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.remove()
    }

    if (jsonLd) upsertJsonLd(jsonLd)
    return () => {
      if (jsonLd) removeJsonLd()
    }
  }, [title, description, path, image, type, noindex, jsonLd])

  return null
}