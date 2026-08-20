import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { Button, Card, Input, Spinner, EmptyState } from '../../components/ui'

interface TrustResult {
  id: string
  name: string
  uniqueCode: string
  logoUrl: string | null
  festivalTypes: string[]
  description: string | null
  city: string | null
  state: string | null
  memberCount: number
  joinMode: string
}

export default function TrustSearchPage() {
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [results, setResults] = useState<TrustResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    setLoading(true)
    try {
      const res = await api.get<TrustResult[]>('/trusts/search', { q: q || undefined, city: city || undefined })
      setResults(res)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    search()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/onboarding" className="mb-6 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">Search trusts</h1>
        <p className="mt-1 text-sm text-stone-500">Find a trust to view or join</p>
        <Card className="mt-5 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Search by name or description" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} className="sm:max-w-40" onKeyDown={(e) => e.key === 'Enter' && search()} />
            <Button onClick={search} loading={loading}><Search className="h-4 w-4" /> Search</Button>
          </div>
        </Card>
        <div className="mt-6 space-y-3">
          {loading ? (
            <Spinner />
          ) : results.length === 0 ? (
            searched && <EmptyState icon={<Search className="h-6 w-6" />} title="No trusts found" description="Try a different search, or create a new trust." action={<Link to="/create-trust" className="btn-primary">Create trust</Link>} />
          ) : (
            results.map((t) => (
              <Card key={t.id} className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-saffron-100 text-lg font-bold text-saffron-700">
                  {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-full w-full object-cover" /> : t.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{t.name}</p>
                  <p className="truncate text-xs text-stone-500">{t.description ?? `${t.city ?? t.state ?? 'India'} · ${t.memberCount} members`}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.festivalTypes.slice(0, 3).map((f) => <span key={f} className="badge bg-saffron-100 text-saffron-700">{f}</span>)}
                  </div>
                </div>
                <Link to={`/trust/${t.id}`} className="btn-outline shrink-0">View</Link>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}