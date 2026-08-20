import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Download, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadReceiptPdf, getReceiptPdfUrl } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Spinner } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import { useActiveTrust } from '../../lib/stores/auth'

export default function ReceiptPreviewPage() {
  const { receiptId } = useParams()
  const active = useActiveTrust()!
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () =>
      api.get<{ total: number; items: any[] }>(`/trusts/${active.trustId}/receipts`, { pageSize: 100 }).then((res) =>
        res.items.find((r) => r.id === receiptId) ?? null
      ),
  })

  useEffect(() => {
    if (!data) return
    let url: string | null = null
    getReceiptPdfUrl(data.id).then((u) => {
      url = u
      setPdfUrl(u)
    }).catch(() => toast.error('Could not load PDF'))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [data])

  if (isLoading || !data) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <a href="/app/receipts" className="mb-4 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-4 w-4" /> Back to receipts
      </a>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Receipt {data.receiptNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">{data.donation?.donorName} · {formatINR(data.donation?.amount ?? 0)} · {new Date(data.generatedAt).toLocaleDateString()}</p>
        </div>
        <button onClick={() => downloadReceiptPdf(data.id)} className="btn-primary">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>
      <Card className="p-2">
        {pdfUrl ? (
          <iframe src={pdfUrl} className="h-[70vh] w-full rounded-xl" title="Receipt PDF" />
        ) : (
          <div className="flex h-[70vh] items-center justify-center text-sm text-stone-400">Loading PDF…</div>
        )}
      </Card>
    </AppLayout>
  )
}