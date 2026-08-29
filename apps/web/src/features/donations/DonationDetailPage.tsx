import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Ban, FileText, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Badge, Spinner, Button } from '../../components/ui'
import { formatINR, timeAgo } from '../../lib/utils'
import { PAYMENT_MODE_LABELS, permissionsForRole, type TrustRole } from '@pavati/shared'
import { useActiveTrust } from '../../lib/stores/auth'

const modeColor: Record<string, string> = { CASH: 'green', UPI: 'blue', MIXED: 'default' }

export default function DonationDetailPage() {
  const { donationId } = useParams()
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const perms = permissionsForRole(active.role as TrustRole) as string[]
  const canVerify = perms.includes('donation:verify')
  const canVoid = perms.includes('donation:void')
  const { data: d, isLoading } = useQuery({
    queryKey: ['donation', donationId],
    queryFn: () => api.get<any>(`/trusts/${active.trustId}/donations/${donationId}`),
  })

  const verify = useMutation({
    mutationFn: (splitId: string) => api.post<{ receipt: any }>(`/trusts/${active.trustId}/donations/${donationId}/splits/${splitId}/verify`, {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['donation', donationId] })
      qc.invalidateQueries({ queryKey: ['donations', active.trustId] })
      qc.invalidateQueries({ queryKey: ['dashboard', active.trustId] })
      if (res.receipt) toast.success(`Payment verified — Pāvati ${res.receipt.receiptNumber} issued`)
      else toast.success('Payment verified')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const voidDonation = async () => {
    if (!confirm('Void this donation and its receipts?')) return
    try {
      await api.post(`/trusts/${active.trustId}/donations/${donationId}/void`, { reason: 'Voided by admin' })
      toast.success('Donation voided')
      qc.invalidateQueries({ queryKey: ['donation', donationId] })
      qc.invalidateQueries({ queryKey: ['donations', active.trustId] })
      qc.invalidateQueries({ queryKey: ['dashboard', active.trustId] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (isLoading || !d) return <AppLayout><Spinner /></AppLayout>

  const pendingSplits = (d.splits ?? []).filter((s: any) => !s.verifiedAt)

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
              <Badge color={d.status === 'SUCCEEDED' ? 'green' : d.status === 'PENDING' ? 'gold' : 'default'} className="text-sm">{d.status === 'PENDING' ? 'Awaiting confirmation' : d.status}</Badge>
            </div>
            {d.status === 'PENDING' && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                Payment not confirmed yet. Verify the UPI payment below to issue the Pāvati receipt.
              </div>
            )}
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-stone-400">Category</dt><dd className="font-medium text-stone-800">{d.category}</dd></div>
              <div><dt className="text-stone-400">Payment mode</dt><dd className="font-medium text-stone-800">{(PAYMENT_MODE_LABELS as Record<string, string>)[d.paymentMode] ?? d.paymentMode}</dd></div>
              <div><dt className="text-stone-400">Phone</dt><dd className="font-medium text-stone-800">{d.phone ?? '—'}</dd></div>
              <div><dt className="text-stone-400">Privacy</dt><dd className="font-medium text-stone-800">{d.privacy}</dd></div>
              <div><dt className="text-stone-400">Collector</dt><dd className="font-medium text-stone-800">{d.collector?.user?.name ?? 'Online'}</dd></div>
              {d.campaign && <div><dt className="text-stone-400">Payment link</dt><dd className="font-medium text-stone-800"><a href={`/donate/${d.campaign.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-saffron-600 hover:underline">{d.campaign.name} <ExternalLink className="h-3 w-3" /></a></dd></div>}
              {d.transactionRef && <div><dt className="text-stone-400">Txn ref</dt><dd className="font-mono text-xs text-stone-800">{d.transactionRef}</dd></div>}
              {d.notes && <div className="sm:col-span-2"><dt className="text-stone-400">Notes</dt><dd className="text-stone-800">{d.notes}</dd></div>}
            </dl>

            {(d.splits?.length ?? 0) > 0 && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <h3 className="text-sm font-bold text-stone-800">Payment breakdown</h3>
                <div className="mt-3 space-y-2">
                  {(d.splits as any[]).map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-stone-100 bg-stone-50 p-3">
                      <Badge color={modeColor[s.paymentMode] ?? 'default'}>{(PAYMENT_MODE_LABELS as Record<string, string>)[s.paymentMode] ?? s.paymentMode}</Badge>
                      <span className="font-bold text-stone-900">{formatINR(s.amount)}</span>
                      {s.transactionRef && <span className="font-mono text-[11px] text-stone-500">{s.transactionRef}</span>}
                      {s.proofUrl && (
                        <a href={s.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-saffron-600 hover:underline">
                          View proof <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        {s.verifiedAt ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Received{s.verifiedBy?.user?.name ? ` · ${s.verifiedBy.user.name}` : ''}{` · ${timeAgo(s.verifiedAt)}`}</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Clock className="h-3.5 w-3.5" /> Not confirmed</span>
                            {canVerify && <Button size="sm" loading={verify.isPending && verify.variables === s.id} onClick={() => verify.mutate(s.id)}>Verify payment</Button>}
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Receipts" action={<Badge color="saffron">{d.receipts?.length ?? 0}</Badge>} />
            <div className="space-y-2 p-4">
              {d.receipts?.length === 0 && (
                <p className="py-3 text-center text-sm text-stone-400">
                  {pendingSplits.length > 0 ? 'Receipt will be issued after verification' : 'No receipts'}
                </p>
              )}
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
          {canVoid && d.status !== 'CANCELLED' && (
            <Button variant="danger" className="w-full" onClick={voidDonation}><Ban className="h-4 w-4" /> Void donation{pendingSplits.length > 0 ? ' (payment not received?)' : ''}</Button>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
