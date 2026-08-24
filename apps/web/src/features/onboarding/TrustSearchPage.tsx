import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { Button, Card, Input, Spinner, EmptyState } from '../../components/ui'
import { useAuth } from '../../lib/stores/auth'
import LogoutButton from '../../components/LogoutButton'

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
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const memberships = useAuth((s) => s.memberships)
  const setSession = useAuth((s) => s.setSession)

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

  const join = async (t: TrustResult) => {
    setJoiningId(t.id)
    try {
      const res = await api.post<{ status?: string; message?: string }>(`/trusts/${t.id}/join`, {})
      if (res.status === 'PENDING_APPROVAL') {
        toast.success('Join request submitted for admin approval')
        return
      }
      toast.success(`Joined ${t.name}!`)
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      setSession(me)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2">
          <Link to="/onboarding" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <LogoutButton />
        </div>
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
            results.map((t) => {
              const joined = memberships.some((m) => m.trustId === t.id)
              return (
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
                  {joined ? (
                    <Link to="/app" className="btn-primary shrink-0">Open app</Link>
                  ) : t.joinMode !== 'INVITE_ONLY' ? (
                    <button onClick={() => join(t)} disabled={joiningId === t.id} className="btn-outline inline-flex shrink-0 items-center gap-1.5 disabled:opacity-50">
                      <UserPlus className="h-3.5 w-3.5" /> {joiningId === t.id ? 'Joining…' : 'Join'}
                    </button>
                  ) : null}
                  <Link to={`/trust/${t.id}`} className="btn-outline shrink-0">View</Link>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}