import { useRef } from 'react'
import { Image as ImageIcon, QrCode } from 'lucide-react'
import type { ReceiptFieldConfig } from '@pavati/shared'
import { cn } from '../lib/utils'

const MIN = 2

interface DragState {
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originX: number
  originY: number
  originW: number
  originH: number
  rect: DOMRect
  moved: boolean
}

interface TemplateFieldOverlayProps {
  fields: ReceiptFieldConfig[]
  aspect: number
  bgUrl: string | null
  values: Record<string, string>
  selected: number | null
  onSelect: (i: number | null) => void
  onUpdate: (i: number, patch: Partial<ReceiptFieldConfig>) => void
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function round(v: number): number {
  return Math.round(v * 10) / 10
}

export default function TemplateFieldOverlay({ fields, aspect, bgUrl, values, selected, onSelect, onUpdate }: TemplateFieldOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const startDrag = (i: number, e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const f = fields[i]
    const rect = containerRef.current!.getBoundingClientRect()
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.x,
      originY: f.y,
      originW: f.width,
      originH: f.height,
      rect,
      moved: false,
    }
  }

  const onPointerMove = (i: number, e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dxPct = ((e.clientX - d.startX) / d.rect.width) * 100
    const dyPct = ((e.clientY - d.startY) / d.rect.height) * 100
    if (Math.abs(dxPct) > 0.4 || Math.abs(dyPct) > 0.4) d.moved = true
    if (d.mode === 'move') {
      onUpdate(i, {
        x: round(clamp(d.originX + dxPct, 0, 100 - d.originW)),
        y: round(clamp(d.originY + dyPct, 0, 100 - d.originH)),
      })
    } else {
      onUpdate(i, {
        width: round(clamp(d.originW + dxPct, MIN, 100 - d.originX)),
        height: round(clamp(d.originH + dyPct, MIN, 100 - d.originY)),
      })
    }
  }

  const onPointerUp = (i: number, e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!d.moved) onSelect(selected === i ? null : i)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none overflow-hidden rounded-lg border border-stone-200 bg-white"
      style={{
        aspectRatio: aspect,
        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {fields.map((f, i) => {
        if (!f.visible) return null
        const isSel = selected === i
        const isImage = f.key === 'logo' || f.key === 'qrCode'
        const value = values[f.key] ?? ''
        return (
          <div
            key={`${f.key}-${i}`}
            onPointerDown={(e) => { startDrag(i, e, 'move'); e.stopPropagation() }}
            onPointerMove={(e) => onPointerMove(i, e)}
            onPointerUp={(e) => onPointerUp(i, e)}
            className={cn('absolute touch-none select-none', isSel ? 'z-10' : 'z-0')}
            style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.width}%`, height: `${f.height}%`, cursor: 'move' }}
          >
            <div
              className={cn(
                'flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md border px-1 text-center',
                isSel
                  ? 'border-saffron-500 bg-saffron-500/15 ring-2 ring-saffron-400'
                  : 'border-dashed border-saffron-400/70 bg-white/40'
              )}
            >
              {isImage ? (
                f.key === 'qrCode'
                  ? <QrCode className="h-4 w-4 text-saffron-700" />
                  : <ImageIcon className="h-4 w-4 text-saffron-700" />
              ) : (
                <>
                  {isSel && <span className="w-full truncate text-[9px] font-semibold leading-tight text-saffron-800">{f.label}</span>}
                  <span className={cn('w-full truncate', isSel ? 'text-[10px] font-medium leading-tight text-stone-800' : 'text-[8px] leading-tight text-stone-600')}>
                    {value || f.label}
                  </span>
                </>
              )}
            </div>
            {isSel && (
              <div
                onPointerDown={(e) => { e.stopPropagation(); startDrag(i, e, 'resize') }}
                onPointerMove={(e) => onPointerMove(i, e)}
                onPointerUp={(e) => onPointerUp(i, e)}
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-sm border border-saffron-700 bg-saffron-500"
                style={{ zIndex: 20 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}