export function formatINR(amount: number, opts: { compact?: boolean } = {}): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    notation: opts.compact ? 'compact' : 'standard',
  })
  return formatter.format(amount)
}

export function formatDate(iso: string | null | undefined, opts: { withTime?: boolean } = {}): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(opts.withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t]
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h === 0) return twoDigits(r)
  return r ? `${ONES[h]} Hundred ${twoDigits(r)}` : `${ONES[h]} Hundred`
}

/** Indian numbering system: rupees in words with paise. */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const crore = Math.floor(rupees / 10_000_000)
  const lakh = Math.floor((rupees % 10_000_000) / 100_000)
  const thousand = Math.floor((rupees % 100_000) / 1000)
  const rest = rupees % 1000

  const parts: string[] = []
  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))

  const rupeesWords = parts.length ? parts.join(' ') : 'Zero'
  if (!paise) return `${rupeesWords} Rupees Only`
  return `${rupeesWords} and ${twoDigits(paise)} Paise Only`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function randomCode(len = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '')
}