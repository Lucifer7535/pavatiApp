import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '../lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'maroon' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-saffron-600 text-white shadow-sm hover:bg-saffron-700',
        variant === 'maroon' && 'bg-maroon-700 text-white shadow-sm hover:bg-maroon-800',
        variant === 'outline' && 'border border-stone-300 bg-white text-stone-700 hover:border-saffron-300 hover:bg-saffron-50',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-stone-200/70 bg-white shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div>
        <h3 className="font-semibold text-stone-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const badgeColors: Record<string, string> = {
  default: 'bg-stone-100 text-stone-700',
  saffron: 'bg-saffron-100 text-saffron-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  maroon: 'bg-maroon-100 text-maroon-700',
  gold: 'bg-amber-100 text-amber-700',
  blue: 'bg-sky-100 text-sky-700',
  purple: 'bg-purple-100 text-purple-700',
}

export function Badge({ color = 'default', children, className }: { color?: string; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeColors[color] ?? badgeColors.default, className)}>{children}</span>
}

const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-100 transition'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(inputClass, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
})

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'min-h-24', className)} {...props} />
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl animate-slide-up sm:m-4 sm:rounded-3xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-md'
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500">
      <Loader2 className="h-7 w-7 animate-spin text-saffron-500" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-500">{icon}</div>}
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      {description && <p className="max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, icon, accent = 'saffron', sub }: { label: string; value: ReactNode; icon?: ReactNode; accent?: string; sub?: ReactNode }) {
  const accents: Record<string, string> = {
    saffron: 'bg-saffron-50 text-saffron-600',
    maroon: 'bg-maroon-50 text-maroon-600',
    green: 'bg-emerald-50 text-emerald-600',
    gold: 'bg-amber-50 text-amber-600',
    blue: 'bg-sky-50 text-sky-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        {icon && <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', accents[accent])}>{icon}</div>}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
          <p className="text-xl font-bold text-stone-900">{value}</p>
          {sub && <p className="text-xs text-stone-400">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-stone-500">
        {total} {total === 1 ? 'record' : 'records'}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <span className="px-2 text-stone-600">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}