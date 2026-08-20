const API_BASE = '/api/v1'

class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshToken = refresh
  localStorage.setItem('pp_access', access)
  localStorage.setItem('pp_refresh', refresh)
}

export function getAccessToken() {
  return accessToken ?? localStorage.getItem('pp_access')
}

export function getRefreshToken() {
  return refreshToken ?? localStorage.getItem('pp_refresh')
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  localStorage.removeItem('pp_access')
  localStorage.removeItem('pp_refresh')
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && retry) {
    const refresh = getRefreshToken()
    if (refresh) {
      const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      if (refreshed.ok) {
        const data = await refreshed.json()
        const s = data.data
        setTokens(s.accessToken, s.refreshToken)
        return request<T>(path, options, false)
      }
      clearTokens()
    }
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const formatted = formatDetails(body?.details)
    const message = formatted ? `${body?.error ?? 'Something went wrong'}: ${formatted}` : (body?.error ?? 'Something went wrong')
    throw new ApiError(res.status, message, body?.details)
  }
  return (body?.data ?? body) as T
}

function formatDetails(details: unknown): string {
  if (!details || typeof details !== 'object') return ''
  const fe = (details as { fieldErrors?: Record<string, unknown> }).fieldErrors
  if (!fe) return ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(fe)) {
    const msgs = Array.isArray(value) ? value : [value]
    for (const m of msgs) if (m) parts.push(`${key}: ${m}`)
  }
  return parts.join(', ')
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => {
    const qs = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : ''
    return request<T>(path + qs)
  },
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: <T>(path: string, options: RequestInit = {}) => request<T>(path, options),
}

export { ApiError }

export function uploadFile(dataUrl: string, kind: 'image' | 'pdf' = 'image') {
  return api.post<{ url: string }>('/uploads', { dataUrl, kind })
}

async function fetchPdf(id: string): Promise<Blob> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/receipts/receipts/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, 'Failed to load receipt PDF')
  return res.blob()
}

export async function downloadReceiptPdf(id: string) {
  const blob = await fetchPdf(id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `receipt-${id}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function getReceiptPdfUrl(id: string) {
  const blob = await fetchPdf(id)
  return URL.createObjectURL(blob)
}