import { type ReceiptData, type ReceiptTemplateView, type FontKey, FONT_CSS, pagePx } from './types.js'
import { buildDrawOps, type MeasureFn } from './layout.js'

export interface CanvasRenderInput {
  template: ReceiptTemplateView
  data: ReceiptData
  background?: HTMLImageElement | HTMLCanvasElement | null
  logo?: HTMLImageElement | HTMLCanvasElement | null
  qr?: HTMLImageElement | HTMLCanvasElement | null
  scale?: number
}

export async function renderReceiptToCanvas(input: CanvasRenderInput): Promise<HTMLCanvasElement> {
  const { template, data, background, logo, qr, scale = 2 } = input
  const page = pagePx(template.pageSize, template.widthMm, template.heightMm)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(page.width * scale)
  canvas.height = Math.round(page.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, page.width, page.height)

  if (background) {
    drawCover(ctx, background, page.width, page.height)
  } else {
    ctx.fillStyle = '#fffdf5'
    ctx.fillRect(0, 0, page.width, page.height)
    ctx.strokeStyle = '#d4af37'
    ctx.lineWidth = 2
    ctx.strokeRect(3, 3, page.width - 6, page.height - 6)
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 1
    ctx.strokeRect(7, 7, page.width - 14, page.height - 14)
  }

  const measure: MeasureFn = (text, size, bold, family) => {
    const key = (family ?? (bold ? 'Mukta-Bold' : 'Mukta')) as FontKey
    const css = FONT_CSS[key] ?? FONT_CSS[bold ? 'Mukta-Bold' : 'Mukta']
    ctx.font = `${css.weight} ${size}px "${css.family}", sans-serif`
    return ctx.measureText(text).width
  }

  const { ops } = buildDrawOps(template, data, {
    logoImage: logo ?? null,
    qrImage: qr ?? null,
    measure,
  })

  for (const op of ops) {
    if (op.kind === 'line') {
      ctx.strokeStyle = '#4a1f0c'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(op.x, op.y)
      ctx.lineTo(op.x + op.width, op.y)
      ctx.stroke()
      continue
    }
    if (op.kind === 'image') {
      const img = op.value === 'qr' ? qr : logo
      if (!img) continue
      const h = op.height
      const w = h * imgHeightToWidth(img)
      let x = op.x
      if (op.align === 'center') x = op.x + (op.width - w) / 2
      else if (op.align === 'right') x = op.x + op.width - w
      ctx.drawImage(img, x, op.y, w, h)
      continue
    }
    if (op.kind !== 'text' || !op.value) continue
    const css = (FONT_CSS as Record<string, { family: string; weight: number }>)[op.fontFamily] ?? FONT_CSS.Mukta
    ctx.font = `${css.weight} ${op.fontSize}px "${css.family}", sans-serif`
    ctx.fillStyle = op.color
    ctx.globalAlpha = op.alpha ?? 1
    const tw = ctx.measureText(op.value).width
    let x = op.x
    if (op.align === 'center') x = op.x + (op.width - tw) / 2
    else if (op.align === 'right') x = op.x + op.width - tw
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(op.value, x, op.y + op.fontSize * 0.85)
    ctx.globalAlpha = 1
  }

  return canvas
}

function imgHeightToWidth(img: HTMLImageElement | HTMLCanvasElement): number {
  const nw = 'naturalWidth' in img ? img.naturalWidth : img.width
  const nh = 'naturalHeight' in img ? img.naturalHeight : img.height
  return nw && nh ? nw / nh : 1
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, w: number, h: number): void {
  const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
  const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
  const imgRatio = iw / ih
  const pageRatio = w / h
  let dw = w
  let dh = h
  if (imgRatio > pageRatio) {
    dh = w / imgRatio
  } else {
    dw = h * imgRatio
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), type)
  })
}