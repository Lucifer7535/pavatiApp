import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { FESTIVALS } from '@pavati/shared'
import { Button, Input } from './ui'
import { cn } from '../lib/utils'

const PREDEFINED = FESTIVALS as readonly string[]
const MAX_FESTIVALS = 20

interface FestivalPickerProps {
  value: string[]
  onChange: (v: string[]) => void
  error?: string
}

export default function FestivalPicker({ value, onChange, error }: FestivalPickerProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const customs = value.filter((f) => !PREDEFINED.includes(f))
  const chips = [...PREDEFINED, ...customs]

  const toggle = (f: string) => {
    onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f])
  }

  const add = () => {
    const name = draft.trim()
    if (!name) { toast.error('Enter a festival name'); return }
    if (name.length > 50) { toast.error('Festival name must be 50 characters or less'); return }
    if (value.length >= MAX_FESTIVALS) { toast.error(`You can select up to ${MAX_FESTIVALS} festivals`); return }
    const canonical = PREDEFINED.find((f) => f.toLowerCase() === name.toLowerCase()) ?? name
    if (value.some((f) => f.toLowerCase() === canonical.toLowerCase())) {
      toast.error('Festival already added')
      setDraft('')
      setAdding(false)
      return
    }
    onChange([...value, canonical])
    setDraft('')
    setAdding(false)
    toast.success(`"${canonical}" added`)
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {chips.map((f) => {
          const selected = value.includes(f)
          return (
            <button
              type="button"
              key={f}
              onClick={() => toggle(f)}
              title={selected ? 'Remove' : 'Select'}
              className={cn(
                'flex items-center justify-between gap-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                selected
                  ? 'border-saffron-500 bg-saffron-50 text-saffron-700'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              )}
            >
              <span className="flex min-w-0 items-center gap-1">
                {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{f}</span>
              </span>
              {selected && <X className="h-3.5 w-3.5 shrink-0" />}
            </button>
          )
        })}
      </div>

      {adding ? (
        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Festival name"
            autoFocus
            className="sm:max-w-xs"
          />
          <Button type="button" size="sm" onClick={add}>Add</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft('') }}>Cancel</Button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-saffron-600 hover:underline">
          <Plus className="h-4 w-4" /> Add festival
        </button>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}