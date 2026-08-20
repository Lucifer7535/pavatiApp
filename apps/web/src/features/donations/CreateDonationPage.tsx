import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Download } from 'lucide-react'
import { PAYMENT_MODE, PAYMENT_MODE_LABELS, PRIVACY, formatINR } from '@pavati/shared'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, CardHeader, Input, Select, Textarea } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { categoryOptions, useTrustFestivals } from '../../lib/festivals'

const schema = z.object({
  donorName: z.string().min(2, 'Donor name is required'),
  phone: z.string().trim().refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number').optional(),
  address: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  paymentMode: z.enum(Object.values(PAYMENT_MODE) as unknown as [string, ...string[]]),
  transactionRef: z.string().optional(),
  paymentDate: z.string().optional(),
  privacy: z.enum(Object.values(PRIVACY) as unknown as [string, ...string[]]).default('PRIVATE'),
  notes: z.string().optional(),
})
type Form = z.infer<typeof schema>

export default function CreateDonationPage() {
  const navigate = useNavigate()
  const active = useActiveTrust()!
  const festivals = useTrustFestivals(active.trustId)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ donation: any; receipt: any } | null>(null)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { paymentMode: 'CASH', category: 'Ganpati Donation', privacy: 'PRIVATE', paymentDate: new Date().toISOString().slice(0, 10) } })

  const amount = watch('amount')
  const mode = watch('paymentMode')

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post<{ donation: any; receipt: any }>(`/trusts/${active.trustId}/donations`, { trustId: active.trustId, ...data })
      setResult(res)
      toast.success('Pāvati recorded and receipt generated!')
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
          <CardHeader title="Pāvati issued ✓" subtitle={`Receipt ${result.receipt.receiptNumber} generated for ${formatINR(result.donation.amount)}`} />
          <div className="p-6">
            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <p className="text-lg font-bold text-emerald-700">{result.donation.donorName}</p>
              <p className="text-3xl font-extrabold text-stone-900">{formatINR(result.donation.amount)}</p>
              <p className="text-sm text-stone-500">{result.donation.category} · {(PAYMENT_MODE_LABELS as Record<string, string>)[result.donation.paymentMode]}</p>
            </div>
            <div className="mt-5 grid gap-2">
              <button onClick={() => downloadReceiptPdf(result.receipt.id)} className="btn-primary"><Download className="h-4 w-4" /> Download PDF</button>
              <Button variant="outline" onClick={() => setResult(null)}>Record another</Button>
              <Button variant="ghost" onClick={() => navigate('/app/donations')}>View all donations</Button>
            </div>
          </div>
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
                <label className="label">Phone <span className="text-stone-400">(for receipt SMS)</span></label>
                <Input placeholder="9876543210" inputMode="numeric" {...register('phone')} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
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
              <label className="label">Amount (₹) *</label>
              <Input type="number" min={1} placeholder="501" {...register('amount')} />
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
              {amount > 0 && <p className="mt-1 text-xs font-semibold text-saffron-600">In words: {formatINR(amount)}</p>}
            </div>
            <div>
              <label className="label">Category *</label>
              <Select {...register('category')}>
                {categoryOptions(festivals).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="label">Payment mode *</label>
              <Select {...register('paymentMode')}>
                {Object.values(PAYMENT_MODE).map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
              </Select>
            </div>
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
            {(mode === 'UPI' || mode === 'BANK_TRANSFER') && (
              <div>
                <label className="label">Transaction reference</label>
                <Input placeholder="UTR / Txn ID" {...register('transactionRef')} />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <Textarea placeholder="Internal notes (optional)" {...register('notes')} />
            </div>
            <Button type="submit" className="w-full py-3" loading={loading}>Issue Pāvati & receipt</Button>
          </div>
        </Card>
      </form>
    </AppLayout>
  )
}