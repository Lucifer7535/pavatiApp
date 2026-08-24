import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, Check, HeartHandshake, LogIn } from 'lucide-react'
import { SUGGESTED_AMOUNTS } from '@pavati/shared'
import { api } from '../../lib/api'
import { Card, Input, Spinner, Button } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import { useAuth } from '../../lib/stores/auth'

interface PublicTrust {
  id: string
  name: string
  logoUrl: string | null
  description: string | null
  city: string | null
  upiId: string | null
  festivalTypes: string[]
}

interface PublicCampaign {
  campaign: { id: string; name: string; description: string | null; category: string | null; suggestedAmounts: number[]; qrCodeUrl: string | null }
  trust: PublicTrust
}

export default function DonatePage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const trustParam = params.get('trust')
  const user = useAuth((s) => s.user)
  const memberships = useAuth((s) => s.memberships)
  const setSession = useAuth((s) => s.setSession)
  const [data, setData] = useState<PublicCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState<number>(501)
  const [customAmount, setCustomAmount] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [joining, setJoining] = useState(false)

  const trustId = trustParam ?? data?.trust.id ?? null
  const isMember = !!user && !!trustId && memberships.some((m) => m.trustId === trustId)

  useEffect(() => {
    if (slug) {
      api.get<PublicCampaign>(`/campaigns/public/campaigns/${slug}`).then((d) => {
        setData(d)
        if (d.campaign.suggestedAmounts?.length) setAmount(d.campaign.suggestedAmounts[0])
      }).finally(() => setLoading(false))
    } else if (trustParam) {
      api.get<PublicTrust>(`/trusts/${trustParam}`).then((t) => {
        setData({ campaign: { id: '', name: `Donation to ${t.name}`, description: null, category: null, suggestedAmounts: [], qrCodeUrl: null }, trust: t })
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [slug, trustParam])

  const join = async () => {
    if (!trustId) return
    setJoining(true)
    try {
      const res = await api.post<{ status?: string; message?: string }>(`/trusts/${trustId}/join`, {})
      if (res.status === 'PENDING_APPROVAL') {
        toast.success('Join request submitted for approval')
        return
      }
      toast.success('Joined! Taking you to donate…')
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      setSession(me)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="p-10"><Spinner /></div>
  if (!data || !data.trust?.id) return <div className="p-10 text-center text-stone-500">Donation page not found</div>

  // Logged-in members go straight into the app to donate
  if (user && isMember && trustId) return <Navigate to="/app/donate" replace />

  const effectiveAmount = customAmount ? Number(customAmount) : amount
  const suggested = data.campaign.suggestedAmounts?.length ? data.campaign.suggestedAmounts : SUGGESTED_AMOUNTS

  const copyUpi = () => {
    if (!data.trust.upiId) return
    navigator.clipboard.writeText(data.trust.upiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied!')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white text-xl font-bold text-saffron-700 shadow-sm">
            {data.trust.logoUrl ? <img src={data.trust.logoUrl} alt="" className="h-full w-full object-cover" /> : data.trust.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">{data.campaign.name}</h1>
            <p className="text-sm text-stone-500">{data.trust.name} · {data.trust.city ?? ''}</p>
          </div>
        </div>
        {data.trust.description && <p className="mt-4 text-sm text-stone-600">{data.trust.description}</p>}
        {data.campaign.description && <p className="mt-2 text-sm text-stone-500">{data.campaign.description}</p>}

        {user && !isMember && (
          <Card className="mt-5 border-saffron-200 bg-saffron-50/60 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <HeartHandshake className="h-5 w-5 shrink-0 text-saffron-600" />
              <p className="flex-1 text-sm font-medium text-stone-700">Join this trust to submit your donation and track receipts.</p>
              <Button size="sm" onClick={join} loading={joining}>Join to donate</Button>
            </div>
          </Card>
        )}

        <Card className="mt-6 p-6">
          <h2 className="font-bold text-stone-900">Choose an amount</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {suggested.map((a) => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustomAmount('') }}
                className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors ${!customAmount && amount === a ? 'border-saffron-500 bg-saffron-50 text-saffron-700' : 'border-stone-200 bg-white text-stone-700 hover:border-saffron-300'}`}
              >
                ₹{a}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <label className="label">Or enter custom amount</label>
            <Input type="number" min={1} placeholder="₹" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
          </div>

          <div className="mt-6 border-t border-stone-100 pt-6 text-center">
            {data.campaign.qrCodeUrl ? (
              <>
                <h3 className="font-semibold text-stone-900">Scan to pay with any UPI app</h3>
                <img src={data.campaign.qrCodeUrl} alt="Payment QR code" className="mx-auto mt-4 w-56 rounded-2xl border border-stone-200 bg-white p-2" />
                {effectiveAmount > 0 && <p className="mt-2 text-sm font-semibold text-stone-700">Amount: {formatINR(effectiveAmount)}</p>}
              </>
            ) : data.trust.upiId ? (
              <h3 className="font-semibold text-stone-900">Pay to the UPI ID below</h3>
            ) : (
              <p className="text-sm text-stone-500">This trust has not added payment details yet. Please contact them directly to donate.</p>
            )}

            {data.trust.upiId && (
              <button onClick={copyUpi} className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-stone-50 px-4 py-2 font-mono text-sm font-semibold text-stone-700 hover:bg-stone-100">
                {copiedUpi ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {data.trust.upiId}
              </button>
            )}
            <p className="mx-auto mt-4 max-w-md text-xs text-stone-400">
              Pay directly using GPay, PhonePe or any UPI app.
              {user
                ? ' Join the trust above to submit your payment for verification.'
                : <> <Link to="/login" state={{ from: `/donate?trust=${data.trust.id}` }} className="inline-flex items-center gap-1 font-semibold text-saffron-600 hover:underline"><LogIn className="inline h-3 w-3" /> Sign in</Link> to submit your payment and get a Pāvati receipt.</>}
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
