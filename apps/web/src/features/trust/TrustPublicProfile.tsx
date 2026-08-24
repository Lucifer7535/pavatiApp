import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users, MapPin, Calendar, Heart, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { Badge, Button, Card, Spinner } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import { useAuth } from '../../lib/stores/auth'

interface TrustPublic {
  id: string
  name: string
  uniqueCode: string
  logoUrl: string | null
  festivalTypes: string[]
  description: string | null
  registrationNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  contactPhone: string | null
  contactEmail: string | null
  website: string | null
  upiId: string | null
  memberCount: number
  committee: { id: string; role: string; position: string | null; user: { id: string; name: string; profileImage: string | null } }[]
  recentDonations: { id: string; donorName: string; amount: number | null; donationDate: string; category: string }[]
}

export default function TrustPublicProfile() {
  const { trustId } = useParams()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const memberships = useAuth((s) => s.memberships)
  const setSession = useAuth((s) => s.setSession)
  const [trust, setTrust] = useState<TrustPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const isMember = !!user && memberships.some((m) => m.trustId === trustId)

  useEffect(() => {
    api.get<TrustPublic>(`/trusts/${trustId}`).then(setTrust).finally(() => setLoading(false))
  }, [trustId])

  const join = async () => {
    if (!trustId || !user) return
    setJoining(true)
    try {
      const res = await api.post<{ status?: string; message?: string }>(`/trusts/${trustId}/join`, {})
      if (res.status === 'PENDING_APPROVAL') {
        toast.success('Join request submitted for admin approval')
        return
      }
      toast.success('Joined! Taking you to the app…')
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      setSession(me)
      navigate('/app')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="p-10"><Spinner /></div>
  if (!trust) return <div className="p-10 text-center text-stone-500">Trust not found</div>

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="bg-gradient-to-br from-maroon-800 via-maroon-700 to-saffron-600 px-4 pb-16 pt-10 text-center text-white">
        <Link to="/" className="absolute left-4 top-4 flex items-center gap-2 text-sm text-white/80 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-3xl font-bold backdrop-blur">
          {trust.logoUrl ? <img src={trust.logoUrl} alt="" className="h-full w-full object-cover" /> : trust.name[0]}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">{trust.name}</h1>
        <p className="mt-1 text-sm text-white/70">{trust.city ?? ''}{trust.state ? `, ${trust.state}` : ''} · {trust.uniqueCode}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {trust.festivalTypes.map((f) => <span key={f} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{f}</span>)}
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-3xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 text-center">
            <Users className="mx-auto h-6 w-6 text-saffron-500" />
            <p className="mt-2 text-2xl font-bold text-stone-900">{trust.memberCount}</p>
            <p className="text-xs text-stone-500">Members</p>
          </Card>
          <Card className="p-5 text-center">
            <Heart className="mx-auto h-6 w-6 text-maroon-600" />
            <p className="mt-2 text-2xl font-bold text-stone-900">{trust.recentDonations.length}</p>
            <p className="text-xs text-stone-500">Recent donors</p>
          </Card>
          <Card className="p-5 text-center">
            <Calendar className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-stone-900">{"Upcoming festival season"}</p>
            <p className="text-xs text-stone-500">2026</p>
          </Card>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="font-bold text-stone-900">About the trust</h2>
          <p className="mt-2 text-sm text-stone-600">{trust.description ?? 'No description yet.'}</p>
          {trust.address && <p className="mt-3 flex items-center gap-2 text-sm text-stone-500"><MapPin className="h-4 w-4" /> {trust.address}</p>}
          {trust.contactPhone && <p className="mt-1 text-sm text-stone-500">📞 {trust.contactPhone}</p>}
          {trust.contactEmail && <p className="mt-1 text-sm text-stone-500">✉️ {trust.contactEmail}</p>}
          {trust.upiId && <p className="mt-1 text-sm text-stone-500">🏦 UPI: {trust.upiId}</p>}
          {isMember ? (
            <Link to="/app" className="btn-primary mt-5 w-full">Open app to donate</Link>
          ) : user ? (
            <Button className="mt-5 w-full" onClick={join} loading={joining}>
              <UserPlus className="mr-2 inline h-4 w-4" /> Join this trust
            </Button>
          ) : (
            <Link to={`/donate?trust=${trust.id}`} className="btn-maroon mt-5 w-full">Donate to {trust.name}</Link>
          )}
          {!isMember && user && (
            <Link to={`/donate?trust=${trust.id}`} className="mt-3 block text-center text-xs font-semibold text-saffron-600 hover:underline">
              Or just view donation options →
            </Link>
          )}
        </Card>

        {trust.committee.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="font-bold text-stone-900">Committee</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {trust.committee.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-saffron-100 text-sm font-bold text-saffron-700">
                    {m.user.profileImage ? <img src={m.user.profileImage} alt="" className="h-full w-full object-cover" /> : m.user.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{m.user.name}</p>
                    <Badge color="saffron">{m.position ?? m.role.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {trust.recentDonations.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="font-bold text-stone-900">Recent donors</h2>
            <div className="mt-3 divide-y divide-stone-100">
              {trust.recentDonations.slice(0, 10).map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-stone-800">{d.donorName}</p>
                    <p className="text-xs text-stone-400">{new Date(d.donationDate).toLocaleDateString()} · {d.category}</p>
                  </div>
                  <p className="font-bold text-maroon-600">{d.amount !== null ? formatINR(d.amount) : '—'}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}