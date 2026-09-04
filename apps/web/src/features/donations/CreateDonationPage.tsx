import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Check, Copy, Download, MessageCircle, Plus, Trash2, Upload } from 'lucide-react'
import { PAYMENT_MODE, PAYMENT_MODE_LABELS, PRIVACY, formatINR } from '@pavati/shared'
import { api, uploadFile, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, CardHeader, Input, Select, Textarea } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { categoryOptions, useTrustFestivals } from '../../lib/festivals'
import { fileToDataUrl } from '../../lib/utils'

const SPLIT_MODES = [PAYMENT_MODE.CASH, PAYMENT_MODE.UPI] as const

interface SplitRow {
  paymentMode: string
  amount: string
  transactionRef: string
  proofUrl: string
}

const emptySplit = (): SplitRow => ({ paymentMode: PAYMENT_MODE.CASH, amount: '', transactionRef: '', proofUrl: '' })

const schema = z.object({
  donorName: z.string().min(2, 'Donor name is required'),
  phone: z.string().trim().refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number').optional(),
  email: z.string().trim().refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address').optional(),
  address: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  paymentDate: z.string().optional(),
  privacy: z.enum(Object.values(PRIVACY) as unknown as [string, ...string[]]).default('PRIVATE'),
  notes: z.string().optional(),
})
type Form = z.infer<typeof schema>

export default function CreateDonationPage() {
  const navigate = useNavigate()
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const festivals = useTrustFestivals(active.trustId)
  const [loading, setLoading] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [upiCampaignId, setUpiCampaignId] = useState('')
  const [splits, setSplits] = useState<SplitRow[]>([emptySplit()])
  const [awaitingPayment, setAwaitingPayment] = useState(false)
  const [result, setResult] = useState<{ donation: any; receipt: any; whatsappShareUrl?: string | null } | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { category: 'Ganpati Donation', privacy: 'PRIVATE', paymentDate: new Date().toISOString().slice(0, 10) } })

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/campaigns`),
  })
  const upiCampaign = campaigns?.find((c) => c.id === upiCampaignId)
  const hasUpi = splits.some((s) => s.paymentMode === PAYMENT_MODE.UPI)
  const total = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)

  const copyUpi = () => {
    if (!active.trust.upiId) return
    navigator.clipboard.writeText(active.trust.upiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied!')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const setSplit = (i: number, patch: Partial<SplitRow>) => {
    setSplits((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const onSplitProof = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadFile(await fileToDataUrl(file))
      setSplit(i, { proofUrl: res.url })
      toast.success('Screenshot attached')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const onSubmit = async (data: Form) => {
    if (total <= 0) return toast.error('Enter a valid payment amount')
    if (splits.some((s) => !(Number(s.amount) > 0))) return toast.error('Each payment line needs an amount greater than 0')
    if (awaitingPayment && !hasUpi) return toast.error('Only online payments can be marked for later confirmation')
    setLoading(true)
    try {
      const res = await api.post<{ donation: any; receipt: any; whatsappShareUrl?: string | null }>(`/trusts/${active.trustId}/donations`, {
        trustId: active.trustId,
        ...data,
        email: data.email?.trim() || null,
        amount: total,
        splits: splits.map((s) => ({
          paymentMode: s.paymentMode,
          amount: Number(s.amount),
          transactionRef: s.transactionRef || null,
          proofUrl: s.proofUrl || null,
        })),
        awaitingPayment,
        ...(hasUpi && upiCampaignId ? { campaignId: upiCampaignId } : {}),
      })
      setResult(res)
      qc.invalidateQueries({ queryKey: ['dashboard', active.trustId] })
      qc.invalidateQueries({ queryKey: ['donations', active.trustId] })
      toast.success(res.receipt ? 'Pāvati recorded and receipt generated!' : 'Saved — awaiting payment confirmation')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <AppLayout>
        <Card className="mx-auto max-w-lg">
          {result.receipt ? (
            <>
              <CardHeader title="Pāvati issued ✓" subtitle={`Receipt ${result.receipt.receiptNumber} generated for ${formatINR(result.donation.amount)}`} />
              <div className="p-6">
                <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                  <p className="text-lg font-bold text-emerald-700">{result.donation.donorName}</p>
                  <p className="text-3xl font-extrabold text-stone-900">{formatINR(result.donation.amount)}</p>
                  <p className="text-sm text-stone-500">{result.donation.category} · {(PAYMENT_MODE_LABELS as Record<string, string>)[result.donation.paymentMode]}</p>
                </div>
                <div className="mt-5 grid gap-2">
                  <button onClick={() => downloadReceiptPdf(result.receipt.id)} className="btn-primary"><Download className="h-4 w-4" /> Download PDF</button>
                  {result.whatsappShareUrl && (
                    <a href={result.whatsappShareUrl} target="_blank" rel="noreferrer" className="btn-whatsapp">
                      <MessageCircle className="h-4 w-4" /> Send receipt on WhatsApp
                    </a>
                  )}
                  <Button variant="outline" onClick={() => { setResult(null); setSplits([emptySplit()]); setAwaitingPayment(false); setUpiCampaignId('') }}>Record another</Button>
                  <Button variant="ghost" onClick={() => navigate('/app/donations')}>View all donations</Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <CardHeader title="Saved — awaiting payment confirmation" subtitle={`${formatINR(result.donation.amount)} from ${result.donation.donorName}`} />
              <div className="p-6">
                <div className="rounded-2xl bg-amber-50 p-4 text-center">
                  <p className="text-lg font-bold text-amber-700">{result.donation.donorName}</p>
                  <p className="text-3xl font-extrabold text-stone-900">{formatINR(result.donation.amount)}</p>
                  <p className="mt-1 text-xs text-stone-500">Verify the payment under Donations to issue the Pāvati receipt.</p>
                </div>
                <div className="mt-5 grid gap-2">
                  <Button variant="outline" onClick={() => { setResult(null); setSplits([emptySplit()]); setAwaitingPayment(false); setUpiCampaignId('') }}>Record another</Button>
                  <Button variant="ghost" onClick={() => navigate('/app/donations')}>View all donations</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-stone-900">New Pāvati</h1>
      <p className="mb-6 mt-1 text-sm text-stone-500">Record an offline donation for {active.trust.name}</p>

      <form onSubmit={handleSubmit(onSubmit, (errs) => {
        const first = (Object.values(errs) as { message?: string }[])[0]
        toast.error(first?.message ?? 'Please fix the highlighted fields')
      })} noValidate className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Donor details" />
          <div className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Donor name *</label>
                <Input placeholder="Full name" {...register('donorName')} autoFocus />
                {errors.donorName && <p className="mt-1 text-xs text-red-600">{errors.donorName.message}</p>}
              </div>
              <div>
                <label className="label">Phone <span className="text-stone-400">(to send receipt on WhatsApp)</span></label>
                <Input placeholder="9876543210" inputMode="numeric" {...register('phone')} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
            </div>
            <div>
              <label className="label">Email <span className="text-stone-400">(to send receipt via email)</span></label>
              <Input type="email" placeholder="donor@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Address</label>
              <Textarea placeholder="Optional address" {...register('address')} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Donation" />
          <div className="space-y-4 p-6">
            <div>
              <label className="label">Category *</label>
              <Select {...register('category')}>
                {categoryOptions(festivals).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label">Payment *</label>
                {splits.length < 5 && (
                  <button type="button" onClick={() => setSplits((rows) => [...rows, emptySplit()])} className="inline-flex items-center gap-1 text-xs font-semibold text-saffron-600 hover:underline">
                    <Plus className="h-3 w-3" /> Add another method
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {splits.map((row, i) => (
                  <div key={i} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-28 shrink-0">
                        <Select value={row.paymentMode} onChange={(e) => setSplit(i, { paymentMode: e.target.value })}>
                          {SPLIT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
                        </Select>
                      </div>
                      <Input type="number" min={1} placeholder="Amount ₹" value={row.amount} onChange={(e) => setSplit(i, { amount: e.target.value })} className="min-w-0 flex-1" />
                      {splits.length > 1 && (
                        <button type="button" onClick={() => setSplits((rows) => rows.filter((_, idx) => idx !== i))} className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {row.paymentMode === PAYMENT_MODE.UPI && (
                      <div className="mt-2 flex items-center gap-2">
                        <Input placeholder="UTR / Txn ID (optional)" value={row.transactionRef} onChange={(e) => setSplit(i, { transactionRef: e.target.value })} className="min-w-0 flex-1" />
                        <label className="shrink-0 cursor-pointer">
                          <span className={`btn-outline inline-flex items-center gap-1 px-2 py-1.5 text-xs ${row.proofUrl ? 'border-emerald-300 text-emerald-700' : ''}`}>
                            <Upload className="h-3.5 w-3.5" /> {row.proofUrl ? 'Attached' : 'Proof'}
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => onSplitProof(i, e)} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-sm font-bold text-stone-800">Total: {formatINR(total)}</p>
            </div>

            {hasUpi && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Collect payment via UPI</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAwaitingPayment(false)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${!awaitingPayment ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-white text-stone-500'}`}>
                    Received now
                  </button>
                  <button type="button" onClick={() => setAwaitingPayment(true)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${awaitingPayment ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-stone-200 bg-white text-stone-500'}`}>
                    To be confirmed later
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                  {awaitingPayment
                    ? 'Saved as pending — an admin verifies the payment before the receipt is issued.'
                    : 'Receipt is issued immediately.'}
                </p>
                {campaigns && campaigns.length > 0 && (
                  <div className="mt-3">
                    <label className="label">Payment link</label>
                    <Select value={upiCampaignId} onChange={(e) => setUpiCampaignId(e.target.value)}>
                      <option value="">Select payment link…</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                )}
                {upiCampaign?.qrCodeUrl ? (
                  <img src={upiCampaign.qrCodeUrl} alt="Payment QR code" className="mx-auto mt-3 w-44 rounded-xl border border-stone-200 bg-white p-2" />
                ) : (
                  <p className="mt-2 text-xs text-stone-500">
                    {upiCampaign
                      ? 'This payment link has no QR yet — share the UPI ID below with the donor.'
                      : active.trust.upiId
                        ? (campaigns?.length ?? 0) > 0
                          ? 'Select a payment link above to show its QR, or share the UPI ID below.'
                          : 'Create a payment link to get a scannable QR for donors.'
                        : 'Trust hasn\u2019t added UPI payment details yet.'}
                  </p>
                )}
                {active.trust.upiId && (
                  <button type="button" onClick={copyUpi} className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-100">
                    {copiedUpi ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {active.trust.upiId}
                  </button>
                )}
                {!upiCampaign?.qrCodeUrl && (
                  <button type="button" onClick={() => navigate('/app/campaigns')} className="mt-3 w-full text-xs font-semibold text-saffron-600 hover:underline">
                    Manage payment links & QR codes →
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Date</label>
                <Input type="date" {...register('paymentDate')} />
              </div>
              <div>
                <label className="label">Privacy</label>
                <Select {...register('privacy')}>
                  <option value="PRIVATE">Private</option>
                  <option value="PUBLIC">Public</option>
                  <option value="ANONYMOUS">Anonymous</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <Textarea placeholder="Internal notes (optional)" {...register('notes')} />
            </div>
            <Button type="submit" className="w-full py-3" loading={loading}>
              {awaitingPayment && hasUpi ? 'Save & mark for verification' : 'Issue Pāvati & receipt'}
            </Button>
          </div>
        </Card>
      </form>
    </AppLayout>
  )
}
