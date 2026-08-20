import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Ban, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Badge, Spinner, Button } from '../../components/ui'
import { formatINR, timeAgo } from '../../lib/utils'
import { PAYMENT_MODE_LABELS } from '@pavati/shared'
import { useActiveTrust } from '../../lib/stores/auth'

export default function DonationDetailPage() {
  const { donationId } = useParams()
  const active = useActiveTrust()!
  const { data: d, isLoading } = useQuery({
    queryKey: ['donation', donationId],
    queryFn: () => api.get<any>(`/trusts/${active.trustId}/donations/${donationId}`),
  })

  const voidDonation = async () => {
    if (!confirm('Void this donation and its receipts?')) return
    try {
      await api.post(`/trusts/${active.trustId}/donations/${donationId}/void`, { reason: 'Voided by admin' })
      toast.success('Donation voided')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (isLoading || !d) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <Link to="/app/donations" className="mb-4 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-4 w-4" /> Back to donations
      </Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${d.donorName}'s donation`} subtitle={`${new Date(d.donationDate).toLocaleString()}`} />
          <div className="p-6">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-saffron-50 to-cream-100 p-5">
              <div>
                <p className="text-sm text-stone-500">Amount</p>
                <p className="text-4xl font-extrabold text-stone-900">{formatINR(d.amount)}</p>
              </div>
              <Badge color={d.status === 'SUCCEEDED' ? 'green' : 'gold'} className="text-sm">{d.status}</Badge>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-stone-400">Category</dt><dd className="font-medium text-stone-800">{d.category}</dd></div>
              <div><dt className="text-stone-400">Payment mode</dt><dd className="font-medium text-stone-800">{(PAYMENT_MODE_LABELS as Record<string, string>)[d.paymentMode] ?? d.paymentMode}</dd></div>
              <div><dt className="text-stone-400">Phone</dt><dd className="font-medium text-stone-800">{d.phone ?? '—'}</dd></div>
              <div><dt className="text-stone-400">Privacy</dt><dd className="font-medium text-stone-800">{d.privacy}</dd></div>
              <div><dt className="text-stone-400">Collector</dt><dd className="font-medium text-stone-800">{d.collector?.user?.name ?? 'Online'}</dd></div>
              <div><dt className="text-stone-400">Online</dt><dd className="font-medium text-stone-800">{d.isOnline ? 'Yes' : 'No'}</dd></div>
              {d.transactionRef && <div><dt className="text-stone-400">Txn ref</dt><dd className="font-mono text-xs text-stone-800">{d.transactionRef}</dd></div>}
              {d.notes && <div className="sm:col-span-2"><dt className="text-stone-400">Notes</dt><dd className="text-stone-800">{d.notes}</dd></div>}
            </dl>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Receipts" action={<Badge color="saffron">{d.receipts?.length ?? 0}</Badge>} />
            <div className="space-y-2 p-4">
              {d.receipts?.length === 0 && <p className="py-3 text-center text-sm text-stone-400">No receipts</p>}
              {d.receipts?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-stone-100 p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-saffron-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-800">{r.receiptNumber}</p>
                      <p className="text-[11px] text-stone-400">{r.status} · {timeAgo(r.generatedAt)}</p>
                    </div>
                  </div>
                  {r.status === 'ACTIVE' && (
                    <button onClick={() => downloadReceiptPdf(r.id)} className="btn-outline px-2.5 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          </Card>
          {d.status === 'SUCCEEDED' && (
            <Button variant="danger" className="w-full" onClick={voidDonation}><Ban className="h-4 w-4" /> Void donation</Button>
          )}
        </div>
      </div>
    </AppLayout>
  )
}