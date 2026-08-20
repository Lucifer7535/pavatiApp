import type { PDFFont } from 'pdf-lib'
import { type FontKey, FONT_CSS } from './types.js'

export { FONT_CSS }
export type { FontKey }

export const FONT_CACHE: Partial<Record<FontKey, { widthOfTextAtSize: (text: string, size: number) => number }>> = {}

export function fontFamilyCss(family: string, bold: boolean): string {
  const key = bold ? 'Mukta-Bold' : normalizeFontLocal(family)
  const f = (FONT_CSS as Record<string, { family: string; weight: number }>)[key] ?? FONT_CSS.Mukta
  return `${f.weight} 1rem "${f.family}", "Noto Sans Devanagari", sans-serif`
}

function normalizeFontLocal(family: string): string {
  if (family in FONT_CSS) return family
  if (/semi/i.test(family)) return 'Mukta-SemiBold'
  if (/bold/i.test(family)) return 'Mukta-Bold'
  if (/medium/i.test(family)) return 'Mukta-Medium'
  return 'Mukta'
}

export function registerPdfFonts(fonts: Partial<Record<FontKey, PDFFont>>): void {
  for (const [key, font] of Object.entries(fonts) as [FontKey, PDFFont][]) {
    if (font) {
      FONT_CACHE[key] = { widthOfTextAtSize: (text, size) => font.widthOfTextAtSize(text, size) }
    }
  }
}

export function unregisterPdfFonts(): void {
  for (const k of Object.keys(FONT_CACHE) as FontKey[]) delete FONT_CACHE[k]
}