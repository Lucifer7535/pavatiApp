import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { SUGGESTED_AMOUNTS } from '@pavati/shared'
import { api } from '../../lib/api'
import { Button, Card, Input, Select, Spinner } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import { categoryOptions } from '../../lib/festivals'

interface PublicCampaign {
  campaign: { id: string; name: string; description: string | null; category: string | null; suggestedAmounts: number[] }
  trust: { id: string; name: string; logoUrl: string | null; description: string | null; city: string | null; upiId: string | null; festivalTypes: string[]; allowAnonymousDonations: boolean }
}

export default function DonatePage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const trustParam = params.get('trust')
  const navigate = useNavigate()
  const [data, setData] = useState<PublicCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState<number>(501)
  const [customAmount, setCustomAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('General Donation')
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (slug) {
      api.get<PublicCampaign>(`/campaigns/public/campaigns/${slug}`).then((d) => {
        setData(d)
        setCategory(d.campaign.category ?? 'General Donation')
        if (d.campaign.suggestedAmounts?.length) setAmount(d.campaign.suggestedAmounts[0])
      }).finally(() => setLoading(false))
    } else if (trustParam) {
      api.get<any>(`/trusts/${trustParam}`).then((t) => {
        setData({ campaign: { id: '', name: `Donation to ${t.name}`, description: null, category: null, suggestedAmounts: [] }, trust: t })
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [slug, trustParam])

  if (loading) return <div className="p-10"><Spinner /></div>
  if (!data) return <div className="p-10 text-center text-stone-500">Donation page not found</div>

  const effectiveAmount = customAmount ? Number(customAmount) : amount
  const suggested = data.campaign.suggestedAmounts?.length ? data.campaign.suggestedAmounts : SUGGESTED_AMOUNTS

  const submit = async () => {
    if (!effectiveAmount || effectiveAmount <= 0) return toast.error('Enter a valid amount')
    if (!anonymous && !donorName) return toast.error('Enter your name (or choose anonymous)')
    setSubmitting(true)
    try {
      const res = await api.post<{ orderId: string; paymentId: string; donationId: string; trustId: string }>(
        `/trusts/${data.trust.id}/payments/online`,
        {
          trustId: data.trust.id,
          campaignId: data.campaign.id || undefined,
          donorName: donorName || undefined,
          phone: phone || undefined,
          email: email || undefined,
          amount: effectiveAmount,
          category,
          anonymous,
        }
      )
      await api.post('/payments/mock/complete', { orderId: res.orderId, paymentId: res.paymentId })
      navigate(`/payment-success?orderId=${res.orderId}&donationId=${res.donationId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const donateUrl = window.location.href

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
            <div className="mt-3">
              <label className="label">Or enter custom amount</label>
              <Input type="number" min={1} placeholder="₹" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Your name</label>
                <Input placeholder="Full name" value={donorName} onChange={(e) => setDonorName(e.target.value)} disabled={anonymous} />
              </div>
              <div>
                <label className="label">Phone <span className="text-stone-400">(for receipt)</span></label>
                <Input placeholder="9876543210" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
              </div>
              <div>
                <label className="label">Email <span className="text-stone-400">(optional)</span></label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Category</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {data.trust && categoryOptions(data.trust.festivalTypes).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>

            {data.trust.allowAnonymousDonations && (
              <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-saffron-600 focus:ring-saffron-500" />
                Donate anonymously
              </label>
            )}

            <Button className="mt-6 w-full py-3.5 text-base" onClick={submit} loading={submitting}>
              Donate {effectiveAmount > 0 ? formatINR(effectiveAmount) : ''}
            </Button>
            <p className="mt-2 text-center text-xs text-stone-400">
              Secure mock payment · You'll receive a digital Pāvati receipt instantly
            </p>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-6 text-center">
            <h3 className="font-semibold text-stone-900">Scan to donate</h3>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-stone-200 bg-white p-4">
              <QRCodeSVG value={donateUrl} size={180} fgColor="#7f1d1d" />
            </div>
            <p className="mt-3 text-xs text-stone-500">Point your phone camera at the QR code</p>
            {data.trust.upiId && (
              <div className="mt-4 rounded-xl bg-stone-50 p-3">
                <p className="text-xs text-stone-400">Or pay directly via UPI</p>
                <p className="font-mono text-sm font-semibold text-stone-700">{data.trust.upiId}</p>
              </div>
            )}
            <button
              onClick={() => { navigator.clipboard.writeText(donateUrl); toast.success('Link copied!') }}
              className="mt-4 text-xs font-semibold text-saffron-600 hover:underline"
            >
              Copy donation link
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}