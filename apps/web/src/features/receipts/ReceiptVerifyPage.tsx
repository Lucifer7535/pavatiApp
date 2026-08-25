import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck, XCircle, Download } from 'lucide-react'
import { api, downloadReceiptPdf } from '../../lib/api'
import { Card, Spinner } from '../../components/ui'
import { formatINR } from '../../lib/utils'

interface VerifyData {
  id: string
  verified: boolean
  trustName: string
  trustLogo: string | null
  receiptNumber: string
  status: string
  generatedAt: string
  donorName: string
  amount: number
  paymentMode: string
  category: string
  donationDate: string
  verificationToken: string
  pdfUrl: string | null
}

export default function ReceiptVerifyPage() {
  const { token } = useParams()
  const [data, setData] = useState<VerifyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<VerifyData>(`/receipts/receipt/verify/${token}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="p-10"><Spinner /></div>

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 p-4">
        <Card className="max-w-sm p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600"><XCircle className="h-8 w-8" /></div>
          <h1 className="mt-4 text-xl font-bold text-stone-900">Receipt not found</h1>
          <p className="mt-2 text-sm text-stone-500">{error ?? 'This verification link is invalid or the receipt has been voided.'}</p>
          <Link to="/" className="btn-outline mt-5 w-full">Go home</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10 p-4">
      <div className="w-full max-w-2xl animate-slide-up">
        <Card className="overflow-hidden">
          <div className="bg-emerald-500 p-6 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20"><ShieldCheck className="h-8 w-8" /></div>
            <h1 className="mt-3 text-xl font-extrabold">Verified receipt</h1>
            <p className="text-sm text-white/80">Authentic Pāvati from {data.trustName}</p>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-saffron-100 text-lg font-bold text-saffron-700">
                {data.trustLogo ? <img src={data.trustLogo} alt="" className="h-full w-full object-cover" /> : data.trustName[0]}
              </div>
              <div>
                <p className="font-bold text-stone-900">{data.trustName}</p>
                <p className="font-mono text-xs text-stone-500">{data.receiptNumber} · {data.status}</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 rounded-2xl bg-stone-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Donor</span><span className="font-semibold">{data.donorName}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Amount</span><span className="font-bold text-maroon-700">{formatINR(data.amount)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Category</span><span>{data.category}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Mode</span><span>{data.paymentMode}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Date</span><span>{new Date(data.donationDate ?? data.generatedAt).toLocaleDateString()}</span></div>
            </div>
            <p className="mt-4 text-center text-xs text-stone-400">Verified via secure link · This receipt is authentic</p>
          </div>
        </Card>

        {data.pdfUrl && (
          <div className="mt-6">
            <Card className="overflow-hidden">
              <div className="p-4">
                <iframe
                  src={data.pdfUrl}
                  className="h-[60vh] w-full rounded-xl border border-stone-200"
                  title={`Receipt ${data.receiptNumber}`}
                />
              </div>
              <div className="border-t border-stone-100 px-6 py-4">
                <button onClick={() => downloadReceiptPdf(data.id)} className="btn-primary w-full">
                  <Download className="h-4 w-4" /> Download PDF
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}