import { useQuery } from '@tanstack/react-query'
import { DONATION_CATEGORIES } from '@pavati/shared'
import { api } from './api'

export function categoryOptions(trustFestivals: string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of [...DONATION_CATEGORIES, ...trustFestivals]) {
    const trimmed = c.trim()
    const key = trimmed.toLowerCase()
    if (trimmed && !seen.has(key)) {
      seen.add(key)
      out.push(trimmed)
    }
  }
  return out
}

export function useTrustFestivals(trustId: string): string[] {
  const { data } = useQuery({
    queryKey: ['trust', trustId],
    queryFn: () => api.get<{ festivalTypes: string[] }>(`/trusts/${trustId}`),
  })
  return data?.festivalTypes ?? []
}