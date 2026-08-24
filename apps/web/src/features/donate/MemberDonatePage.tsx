import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Copy, Check, HeartHandshake, Upload } from 'lucide-react'
import { SUGGESTED_AMOUNTS, PRIVACY, permissionsForRole, type TrustRole } from '@pavati/shared'
import { api, uploadFile } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Button, Input, Select } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { fileToDataUrl, formatINR } from '../../lib/utils'

export default function MemberDonatePage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const [amount, setAmount] = useState<number>(501)
  const [customAmount, setCustomAmount] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string; amount: number } | null>(null)

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/campaigns`),
  })
  const selectedCampaign = campaigns?.find((c) => c.id === campaignId)
  const activeCampaigns = (campaigns ?? []).filter((c) => c.active !== false)

  useEffect(() => {
    if (!campaignId && activeCampaigns.length > 0) setCampaignId(activeCampaigns[0].id)
  }, [campaignId, activeCampaigns])

  const effectiveAmount = customAmount ? Number(customAmount) : amount
  const suggested: number[] = selectedCampaign?.suggestedAmounts?.length ? selectedCampaign.suggestedAmounts : SUGGESTED_AMOUNTS

  const copyUpi = () => {
    if (!active.trust.upiId) return
    navigator.clipboard.writeText(active.trust.upiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied!')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const onProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingProof(true)
    try {
      const res = await uploadFile(await fileToDataUrl(file))
      setProofUrl(res.url)
      toast.success('Screenshot attached')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingProof(false)
    }
  }

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ donation: any }>(`/trusts/${active.trustId}/my-donations`, {
        amount: effectiveAmount,
        ...(campaignId ? { campaignId } : {}),
        transactionRef: transactionRef || null,
        proofUrl: proofUrl || null,
        privacy: PRIVACY.PRIVATE,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['dashboard', active.trustId] })
      qc.invalidateQueries({ queryKey: ['donations', active.trustId] })
      setSubmitted({ id: res.donation.id, amount: res.donation.amount })
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (permissionsForRole(active.role as TrustRole).includes('donation:create')) {
    return <Navigate to="/app/dashboard" replace />
  }

  if (submitted) {
    return (
      <AppLayout>
        <Card className="mx-auto max-w-lg">
          <CardHeader title="Payment submitted ✓" subtitle={`${formatINR(submitted.amount)} awaiting confirmation`} />
          <div className="p-6">
            <div className="rounded-2xl bg-amber-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-amber-500" />
              <p className="mt-3 text-lg font-bold text-amber-700">{formatINR(submitted.amount)}</p>
              <p className="mt-1 text-sm text-stone-600">An admin will verify your payment and issue your Pāvati receipt.</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-stone-400"><Clock className="h-3.5 w-3.5" /> Track it under Donations</p>
            </div>
            <div className="mt-5 grid gap-2">
              <Button variant="outline" onClick={() => { setSubmitted(null); setTransactionRef(''); setProofUrl(''); setCustomAmount('') }}>Donate again</Button>
              <Link to="/app/donations" className="btn-ghost text-center text-sm">View my donations</Link>
            </div>
          </div>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-maroon-700 text-white"><HeartHandshake className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Donate to {active.trust.name}</h1>
          <p className="text-sm text-stone-500">Pay via UPI, then submit your payment for verification</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="1 · Pay via UPI" />
          <div className="space-y-4 p-6">
            {activeCampaigns.length > 0 && (
              <div>
                <label className="label">Payment link</label>
                <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  {activeCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            )}
            {selectedCampaign?.qrCodeUrl ? (
              <img src={selectedCampaign.qrCodeUrl} alt="Payment QR code" className="mx-auto w-52 rounded-xl border border-stone-200 bg-white p-2" />
            ) : (
              <p className="text-xs text-stone-500">
                {active.trust.upiId
                  ? 'Pay directly using GPay, PhonePe or any UPI app.'
                  : 'Trust hasn\u2019t added UPI payment details yet.'}
              </p>
            )}
            {active.trust.upiId && (
              <button type="button" onClick={copyUpi} className="mx-auto flex w-fit items-center gap-2 rounded-lg bg-stone-50 px-4 py-2 font-mono text-sm font-semibold text-stone-700 hover:bg-stone-100">
                {copiedUpi ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {active.trust.upiId}
              </button>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="2 · Confirm your payment" />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!(effectiveAmount > 0)) return toast.error('Enter a valid amount')
              submit.mutate()
            }}
            className="space-y-4 p-6"
          >
            <div>
              <label className="label">Amount</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
                {suggested.map((a) => (
                  <button key={a} type="button" onClick={() => { setAmount(a); setCustomAmount('') }} className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors ${!customAmount && amount === a ? 'border-saffron-500 bg-saffron-50 text-saffron-700' : 'border-stone-200 bg-white text-stone-700 hover:border-saffron-300'}`}>
                    ₹{a}
                  </button>
                ))}
              </div>
              <Input type="number" min={1} placeholder="Custom amount ₹" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} className="mt-2 max-w-xs" />
            </div>

            <div>
              <label className="label">UPI transaction ID / UTR</label>
              <Input placeholder="e.g. 123456789012" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
            </div>

            <div>
              <label className="label">Screenshot of payment (optional)</label>
              <label className="btn-outline inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> {proofUrl ? 'Attached ✓' : uploadingProof ? 'Uploading…' : 'Attach screenshot'}
                <input type="file" accept="image/*" className="hidden" onChange={onProofUpload} />
              </label>
            </div>

            <Button type="submit" className="w-full py-3" loading={submit.isPending}>
              Submit {effectiveAmount > 0 ? formatINR(effectiveAmount) : ''} for verification
            </Button>
            <p className="text-[11px] leading-relaxed text-stone-400">
              Your donation will appear as “Awaiting confirmation” until a trust admin verifies the payment. The Pāvati receipt is issued automatically after verification.
            </p>
          </form>
        </Card>
      </div>
    </AppLayout>
  )
}
