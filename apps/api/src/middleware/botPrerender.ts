import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'

const PREVIEW_BOT_MARKERS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'slackbot',
  'pinterestbot',
  'tumblr',
  'pocket',
  'line-poker',
  'viber',
  'skypeuripreview',
  'embedly',
  'iframely',
  'snapchat',
  'vk share',
  'bot-preview',
]

const STATIC_EXT_RE = /\.(js|css|png|jpe?g|webp|gif|svg|ico|json|webmanifest|xml|txt|woff2?)$/i

const CACHE_TTL_MS = 15 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

interface CacheEntry {
  html: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function cacheGet(path: string): string | null {
  const entry = cache.get(path)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(path)
    return null
  }
  return entry.html
}

function cacheSet(path: string, html: string) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(path, { html, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function isPreviewBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  if (/googlebot|bingbot|slurp|duckduckbot|yandex|baiduspider|petalbot/i.test(ua)) return false
  return PREVIEW_BOT_MARKERS.some((m) => ua.includes(m))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absUrl(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${config.publicBaseUrl.replace(/\/$/, '')}${url}`
  return url
}

interface DocParams {
  title: string
  description: string
  url: string
  image?: string | null
  type?: string
  jsonLd?: object
  bodyHtml: string
}

function renderDoc({ title, description, url, image, type, jsonLd, bodyHtml }: DocParams): string {
  const ogImage = absUrl(image ?? '') || `${config.publicBaseUrl.replace(/\/$/, '')}/logo.png`
  const ogType = type ?? 'website'
  const jsonLdHtml = jsonLd
    ? `\n    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, '<\\/script')}</script>`
    : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${absUrl(url)}" />
    <meta property="og:site_name" content="P\u0101vati Pustak" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${absUrl(url)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:type" content="${ogType}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ogImage}" />${jsonLdHtml}
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`
}

interface PreviewMeta {
  title: string
  description: string
  url: string
  image: string | null
  type: string
  jsonLd: object
  bodyHtml: string
}

async function loadPreviewMeta(path: string): Promise<PreviewMeta | null> {
  const base = config.publicBaseUrl.replace(/\/$/, '')

  const trustMatch = path.match(/^\/trust\/[a-zA-Z0-9-]+\/?$/)
  if (trustMatch) {
    const trustId = path.replace(/^\/trust\//, '').replace(/\/$/, '')
    const trust = await prisma.trust.findUnique({ where: { id: trustId } })
    if (!trust) return null
    const title = `${trust.name} — Donate & Join`
    const description = trust.description ?? `${trust.name} — a registered trust accepting donations. View its profile and donate securely via Pāvati Pustak.`
    return {
      title,
      description,
      url: `${base}/trust/${trust.id}`,
      image: trust.logoUrl,
      type: 'organization',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NGO',
        name: trust.name,
        description: trust.description ?? undefined,
        url: `${base}/trust/${trust.id}`,
        address: { '@type': 'PostalAddress', addressLocality: trust.city ?? undefined, addressRegion: trust.state ?? undefined },
      },
      bodyHtml: `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#292524">
  <h1 style="font-size:28px;margin:0 0 8px">${escapeHtml(trust.name)}</h1>
  ${trust.city ? `<p style="margin:0 0 8px;color:#78716c">${escapeHtml([trust.city, trust.state].filter(Boolean).join(', '))}</p>` : ''}
  ${trust.description ? `<p style="line-height:1.6">${escapeHtml(trust.description)}</p>` : ''}
  <p><a href="${base}/trust/${trust.id}" style="color:#9a3412;font-weight:600">Donate securely via Pāvati Pustak →</a></p>
</div>`,
    }
  }

  const slugMatch = path.match(/^\/donate\/[a-zA-Z0-9-]+\/?$/)
  if (slugMatch) {
    const slug = path.replace(/^\/donate\//, '').replace(/\/$/, '')
    const campaign = await prisma.paymentCampaign.findUnique({
      where: { slug },
      include: { trust: true },
    })
    if (!campaign || !campaign.active) return null
    const title = `${campaign.name} — Donate to ${campaign.trust.name}`
    const description = campaign.description ?? `Donate to ${campaign.trust.name} via Pāvati Pustak. Secure UPI donation with an instant verifiable receipt.`
    return {
      title,
      description,
      url: `${base}/donate/${campaign.slug}`,
      image: campaign.qrCodeUrl ?? campaign.trust.logoUrl,
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        url: `${base}/donate/${campaign.slug}`,
        description,
      },
      bodyHtml: `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#292524">
  <h1 style="font-size:28px;margin:0 0 8px">${escapeHtml(campaign.name)}</h1>
  <p style="margin:0 0 8px;color:#78716c">Donate to ${escapeHtml(campaign.trust.name)}</p>
  ${campaign.description ? `<p style="line-height:1.6">${escapeHtml(campaign.description)}</p>` : ''}
  <p><a href="${base}/donate/${campaign.slug}" style="color:#9a3412;font-weight:600">Donate securely via Pāvati Pustak →</a></p>
</div>`,
    }
  }

  return null
}

export function botPrerender() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method !== 'GET') return next()
      if (!isPreviewBot(req.headers['user-agent'] ?? '')) return next()

      const path = req.path
      if (path.startsWith('/api') || path.startsWith('/uploads') || path === '/health' || path === '/sitemap.xml' || path === '/robots.txt') return next()
      if (STATIC_EXT_RE.test(path)) return next()

      const cached = cacheGet(path)
      if (cached) {
        res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')
        res.setHeader('x-prerender', '1')
        return res.type('html').send(cached)
      }

      const meta = await loadPreviewMeta(path)
      if (!meta) return next()

      const html = renderDoc(meta)
      cacheSet(path, html)
      res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')
      res.setHeader('x-prerender', '1')
      return res.type('html').send(html)
    } catch (err) {
      return next(err)
    }
  }
}