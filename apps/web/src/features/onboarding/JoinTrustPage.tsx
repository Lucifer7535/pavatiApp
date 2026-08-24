import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, Search } from 'lucide-react'
import { api } from '../../lib/api'
import LogoutButton from '../../components/LogoutButton'
import { useAuth } from '../../lib/stores/auth'
import { Button, Card, Input } from '../../components/ui'

interface TrustLookup {
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

export default function JoinTrustPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [trust, setTrust] = useState<TrustLookup | null>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const memberships = useAuth((s) => s.memberships)

  const lookup = async () => {
    if (code.trim().length < 3) return toast.error('Enter a join code')
    setLoading(true)
    try {
      const res = await api.get<TrustLookup>(`/trusts/by-code/${encodeURIComponent(code.trim())}`)
      setTrust(res)
      if (memberships.some((m) => m.trustId === res.id)) {
        toast.info('You are already a member of this trust')
      }
    } catch (e: any) {
      toast.error(e.message)
      setTrust(null)
    } finally {
      setLoading(false)
    }
  }

  const join = async () => {
    if (!trust) return
    setJoining(true)
    try {
      const res = await api.post<{ status?: string }>(`/trusts/${trust.id}/join`, { code: code.trim() })
      if (res.status === 'PENDING_APPROVAL') {
        toast.success('Join request submitted for approval')
        navigate('/app')
        return
      }
      setJoined(true)
      toast.success('Joined the trust!')
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      useAuth.getState().setSession(me)
      setTimeout(() => navigate('/app'), 1200)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="mb-6 flex items-center gap-2">
          <Link to="/onboarding" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <LogoutButton />
        </div>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white"><Search className="h-7 w-7" /></div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Join a trust</h1>
          <p className="mt-1 text-sm text-stone-500">Enter the join code shared by your trust admin</p>
        </div>
        <Card className="p-6">
          <div className="flex gap-2">
            <Input placeholder="e.g. GMM2026ABC" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && lookup()} autoFocus />
            <Button onClick={lookup} loading={loading}>Find</Button>
          </div>

          {trust && (
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-saffron-100 text-lg font-bold text-saffron-700">
                  {trust.logoUrl ? <img src={trust.logoUrl} alt="" className="h-full w-full object-cover" /> : trust.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{trust.name}</p>
                  <p className="text-xs text-stone-500">{trust.city ?? trust.state ?? 'India'} · {trust.memberCount} members · {trust.festivalTypes.slice(0, 2).join(', ')}</p>
                </div>
              </div>
              {joined ? (
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <Check className="h-5 w-5" /> Joined! Redirecting…
                </div>
              ) : (
                <Button className="mt-4 w-full" onClick={join} loading={joining}>Join {trust.name}</Button>
              )}
            </div>
          )}
        </Card>
        <p className="mt-4 text-center text-sm text-stone-500">
          Try the demo join code: <button onClick={() => setCode('GANESH2026ABC')} className="font-mono font-semibold text-saffron-600 hover:underline">GANESH2026ABC</button>
        </p>
      </div>
    </div>
  )
}