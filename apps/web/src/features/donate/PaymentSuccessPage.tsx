import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, ArrowLeft } from 'lucide-react'
import { api, downloadReceiptPdf } from '../../lib/api'
import { Card, Spinner } from '../../components/ui'
import { formatINR } from '../../lib/utils'

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<{ donation: any; receipt: any; verificationUrl?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const orderId = params.get('orderId')
    if (!orderId) return setLoading(false)
    api.post<{ alreadyProcessed?: boolean; donation: any; receipt: any; verificationUrl?: string }>('/payments/mock/complete', {
      orderId,
      paymentId: `pay_${Date.now()}`,
    }).then((res) => {
      const saved = { donation: res.donation, receipt: res.receipt, verificationUrl: res.verificationUrl }
      setState(saved)
      sessionStorage.setItem('pp_last_receipt', JSON.stringify(saved))
    }).finally(() => setLoading(false))
  }, [params])

  if (loading && !state) return <div className="p-10"><Spinner /></div>

  const saved = state ?? JSON.parse(sessionStorage.getItem('pp_last_receipt') ?? 'null') as { donation: any; receipt: any; verificationUrl?: string } | null

  const d = saved?.donation
  const receipt = saved?.receipt

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-cream-50 to-saffron-50 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <Card className="overflow-hidden">
          <div className="bg-emerald-500 p-8 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20"><CheckCircle2 className="h-10 w-10" /></div>
            <h1 className="mt-4 text-2xl font-extrabold">Donation successful!</h1>
            <p className="mt-1 text-sm text-white/80">धन्यवाद - Thank you for your generous support</p>
          </div>
          <div className="p-6">
            {d && (
              <div className="space-y-2 rounded-2xl bg-stone-50 p-4 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">Amount</span><span className="font-bold text-maroon-700">{formatINR(d.amount)}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Category</span><span>{d.category}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Donor</span><span>{d.donorName}</span></div>
                {receipt && <div className="flex justify-between"><span className="text-stone-500">Receipt No</span><span className="font-mono font-semibold">{receipt.receiptNumber}</span></div>}
              </div>
            )}
            <div className="mt-5 space-y-2">
              {receipt && (
                <button onClick={() => downloadReceiptPdf(receipt.id)} className="btn-primary w-full">
                  <Download className="h-4 w-4" /> Download Pāvati (PDF)
                </button>
              )}
              {saved?.verificationUrl && (
                <Link to={saved.verificationUrl} className="btn-outline w-full">Verify receipt</Link>
              )}
              <Link to="/" className="btn-ghost w-full">
                <ArrowLeft className="h-4 w-4" /> Back to home
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}