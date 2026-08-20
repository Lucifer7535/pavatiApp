import { useEffect, useRef, useState } from 'react'
import { renderReceiptToCanvas } from '@pavati/receipt-engine'
import type { ReceiptTemplateView } from '@pavati/receipt-engine'
import { Spinner } from './ui'
import { cn } from '../lib/utils'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

export interface PreviewData {
  trustName: string
  trustAddress?: string
  receiptNumber: string
  receiptDate: string
  donorName: string
  donorPhone?: string
  donorAddress?: string
  amount: number
  category: string
  paymentMode: string
  transactionRef?: string
  collectorName?: string
  footerText?: string
}

export function ReceiptCanvasPreview({
  template,
  data,
  scale = 1.6,
  className,
}: {
  template: ReceiptTemplateView
  data: PreviewData
  scale?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        const bg = template.backgroundImageUrl ? await loadImage(template.backgroundImageUrl) : null
        if (cancelled) return
        const rendered = await renderReceiptToCanvas({
          template,
          data: data as any,
          background: bg ?? undefined,
          scale,
        })
        if (cancelled) return
        const target = canvasRef.current
        if (target) {
          target.width = rendered.width
          target.height = rendered.height
          const ctx = target.getContext('2d')!
          ctx.clearRect(0, 0, target.width, target.height)
          ctx.drawImage(rendered, 0, 0)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [template, data, scale])

  if (error) return <div className="flex h-40 items-center justify-center text-sm text-red-600">{error}</div>
  return (
    <div className="flex flex-col items-center gap-2">
      {!canvasRef.current && <Spinner label="Rendering preview…" />}
      <canvas ref={canvasRef} className={cn('h-auto max-w-full', className)} />
    </div>
  )
}