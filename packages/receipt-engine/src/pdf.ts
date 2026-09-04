import 'regenerator-runtime/runtime.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { type FontKey, type ReceiptData, type ReceiptTemplateView } from './types.js'
import { buildDrawOps, type MeasureFn } from './layout.js'
import { registerPdfFonts, unregisterPdfFonts, FONT_CACHE } from './fonts.js'

export interface PdfFontFile {
  key: FontKey
  file: string
}

export const FONT_FILES: PdfFontFile[] = [
  { key: 'Mukta', file: 'Mukta-Regular.ttf' },
  { key: 'Mukta-Medium', file: 'Mukta-Medium.ttf' },
  { key: 'Mukta-SemiBold', file: 'Mukta-SemiBold.ttf' },
  { key: 'Mukta-Bold', file: 'Mukta-Bold.ttf' },
]

function fontsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'fonts'),
    path.join(here, 'src', 'fonts'),
    path.join(here, '..', '..', 'src', 'fonts'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'Mukta-Regular.ttf'))) return c
  }
  const pkgRoot = path.dirname(fileURLToPath(import.meta.url))
  return path.join(pkgRoot, 'fonts')
}

export function readMuktaFontFiles(): Record<string, Uint8Array> {
  const dir = fontsDir()
  const out: Record<string, Uint8Array> = {}
  for (const f of FONT_FILES) {
    const p = path.join(dir, f.file)
    if (!fs.existsSync(p)) throw new Error(`Missing font file: ${p}`)
    out[f.key] = fs.readFileSync(p)
  }
  return out
}

export interface PdfRenderInput {
  template: ReceiptTemplateView
  data: ReceiptData
  background?: Uint8Array | null
  logo?: Uint8Array | null
  qr?: Uint8Array | null
}

export async function renderReceiptPdf(input: PdfRenderInput): Promise<Uint8Array> {
  const { template, data, background, logo, qr } = input

  const fontFiles = readMuktaFontFiles()
  const fonts: Partial<Record<FontKey, PDFFont>> = {}
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  for (const [key, bytes] of Object.entries(fontFiles) as [FontKey, Uint8Array][]) {
    fonts[key] = await doc.embedFont(bytes)
  }
  registerPdfFonts(fonts)

  const measure: MeasureFn = (text, size, bold) => {
    let w = 0
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0
      const base = code > 0x0900 && code < 0x0980 ? size * 0.85 : code === 0x20b9 ? size * 0.6 : size * 0.52
      w += bold ? base * 1.08 : base
    }
    return w
  }
  const { ops, page } = buildDrawOps(template, data, { measure })

  const pxToPt = 0.75
  const pageWidth = Math.round(page.width * pxToPt)
  const pageHeight = Math.round(page.height * pxToPt)
  const pdfPage = doc.addPage([pageWidth, pageHeight])

  let bgImage: PDFImage | null = null
  if (background) {
    bgImage = await doc.embedJpg(background).catch(() => null)
    if (!bgImage) bgImage = (await doc.embedPng(background).catch(() => null)) as PDFImage | null
  }
  if (bgImage) {
    const fit = drawBackgroundCover(bgImage, pageWidth, pageHeight)
    pdfPage.drawImage(bgImage, {
      x: fit.x,
      y: fit.y,
      width: fit.width,
      height: fit.height,
    })
  }

  const logoImage: PDFImage | null = logo ? await doc.embedPng(logo).catch(() => null) : null
  const qrImage: PDFImage | null = qr ? await doc.embedPng(qr).catch(() => null) : null

  for (const op of ops) {
    if (op.kind === 'image') {
      const img = op.value === 'qr' ? qrImage : logoImage
      if (!img) continue
      const w = op.width * pxToPt
      const h = op.height * pxToPt
      pdfPage.drawImage(img, {
        x: op.x * pxToPt,
        y: pageHeight - op.y * pxToPt - h,
        width: w,
        height: h,
      })
      continue
    }
    if (op.kind === 'line') {
      const x = op.x * pxToPt
      const y = pageHeight - op.y * pxToPt
      pdfPage.drawLine({
        start: { x, y },
        end: { x: x + op.width * pxToPt, y },
        thickness: 1,
        color: rgb(0.29, 0.12, 0.05),
      })
      continue
    }
    if (op.kind !== 'text' || !op.value) continue
    const font = (fonts as Record<string, PDFFont>)[op.fontFamily] ?? fonts.Mukta!
    const fontSize = op.fontSize * pxToPt
    const x = op.x * pxToPt
    const y = pageHeight - op.y * pxToPt - fontSize * 0.82
    const width = op.width * pxToPt
    let tx = x
    if (op.align === 'center') {
      const tw = font.widthOfTextAtSize(op.value, fontSize)
      tx = x + (width - tw) / 2
    } else if (op.align === 'right') {
      const tw = font.widthOfTextAtSize(op.value, fontSize)
      tx = x + width - tw
    }
    pdfPage.drawText(op.value, {
      x: tx,
      y,
      size: fontSize,
      font,
      color: hexToRgb(op.color),
      opacity: op.alpha ?? 1,
    })
  }

  const bytes = await doc.save()
  unregisterPdfFonts()
  return bytes
}

function drawBackgroundCover(img: PDFImage, w: number, h: number): { x: number; y: number; width: number; height: number } {
  const imgRatio = img.width / img.height
  const pageRatio = w / h
  let dw = w
  let dh = h
  if (imgRatio > pageRatio) {
    dh = w / imgRatio
  } else {
    dw = h * imgRatio
  }
  return { x: (w - dw) / 2, y: (h - dh) / 2, width: dw, height: dh }
}

function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const m = (hex ?? '').replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return rgb(0, 0, 0)
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export const nodeMeasure: MeasureFn = (text, size, _bold) => {
  const font = FONT_CACHE.Mukta
  return font ? font.widthOfTextAtSize(text, size) : text.length * size * 0.55
}