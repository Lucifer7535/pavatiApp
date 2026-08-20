import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Wallet, PlusCircle } from 'lucide-react'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Spinner, Badge, Input, Select, Pagination, EmptyState, PageHeader } from '../../components/ui'
import { formatINR, timeAgo } from '../../lib/utils'
import { PAYMENT_MODE_LABELS, PAYMENT_MODE } from '@pavati/shared'
import { useActiveTrust } from '../../lib/stores/auth'
import { categoryOptions, useTrustFestivals } from '../../lib/festivals'

const statusColor: Record<string, string> = { SUCCEEDED: 'green', PENDING: 'gold', FAILED: 'red', REFUNDED: 'blue', CANCELLED: 'default' }
const modeColor: Record<string, string> = { CASH: 'green', UPI: 'blue', ONLINE: 'purple', BANK_TRANSFER: 'blue', CARD: 'gold', OTHER: 'default' }

export default function DonationsPage() {
  const active = useActiveTrust()!
  const festivals = useTrustFestivals(active.trustId)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('')
  const [category, setCategory] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['donations', active.trustId, page, q, mode, category],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: any[] }>(`/trusts/${active.trustId}/donations`, { page, pageSize: 20, q: q || undefined, paymentMode: mode || undefined, category: category || undefined }),
  })

  return (
    <AppLayout>
      <PageHeader title="Donations" subtitle="Every Pāvati recorded for this trust" action={<Link to="/app/donations/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New Pāvati</Link>} />

      <Card>
        <div className="flex flex-col gap-2 border-b border-stone-100 p-4 sm:flex-row">
          <Input placeholder="Search donor…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="sm:max-w-xs" />
          <Select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1) }} className="sm:max-w-40">
            <option value="">All modes</option>
            {Object.values(PAYMENT_MODE).map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</option>)}
          </Select>
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="sm:max-w-52">
            <option value="">All categories</option>
            {categoryOptions(festivals).map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        {isLoading || !data ? <Spinner /> : data.items.length === 0 ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="No donations found" description="Adjust filters or create a new Pāvati." action={<Link to="/app/donations/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New Pāvati</Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                    <th className="px-5 py-3">Donor</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Mode</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.items.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <Link to={`/app/donations/${d.id}`} className="font-medium text-stone-800 hover:text-saffron-600">{d.donorName}</Link>
                        <p className="text-xs text-stone-400">{d.category}{d.isOnline ? ' · online' : ''}</p>
                      </td>
                      <td className="px-5 py-3 font-bold text-stone-900">{formatINR(d.amount)}</td>
                      <td className="px-5 py-3"><Badge color={modeColor[d.paymentMode]}>{(PAYMENT_MODE_LABELS as Record<string, string>)[d.paymentMode] ?? d.paymentMode}</Badge></td>
                      <td className="px-5 py-3"><Badge color={statusColor[d.status] ?? 'default'}>{d.status}</Badge></td>
                      <td className="px-5 py-3 text-stone-500">{new Date(d.donationDate).toLocaleDateString()} · {timeAgo(d.donationDate)}</td>
                      <td className="px-5 py-3 text-right">
                        {d.receipts?.[0] ? (
                          <button onClick={() => downloadReceiptPdf(d.receipts[0].id)} className="text-xs font-semibold text-saffron-600 hover:underline">PDF ↓</button>
                        ) : <span className="text-xs text-stone-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3">
              <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Card>
    </AppLayout>
  )
}