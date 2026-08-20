import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Download } from 'lucide-react'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Badge, Spinner, Input, Select, Pagination, EmptyState, PageHeader } from '../../components/ui'
import { formatINR, timeAgo } from '../../lib/utils'
import { useActiveTrust } from '../../lib/stores/auth'

export default function ReceiptsPage() {
  const active = useActiveTrust()!
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', active.trustId, page, q, status],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: any[] }>(`/trusts/${active.trustId}/receipts`, { page, pageSize: 20, status: status || undefined }),
  })

  const filtered = data?.items.filter((r) => !q || r.receiptNumber.toLowerCase().includes(q.toLowerCase()) || r.donation?.donorName.toLowerCase().includes(q.toLowerCase()))

  return (
    <AppLayout>
      <PageHeader title="Receipts" subtitle="All generated Pāvati receipts" />
      <Card>
        <div className="flex flex-col gap-2 border-b border-stone-100 p-4 sm:flex-row">
          <Input placeholder="Search receipt no. or donor…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-40">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="VOID">Void</option>
          </Select>
        </div>
        {isLoading || !data ? <Spinner /> : filtered!.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No receipts found" description="Receipts are generated automatically with each donation." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                    <th className="px-5 py-3">Receipt No</th>
                    <th className="px-5 py-3">Donor</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Generated</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered!.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <Link to={`/app/receipts/${r.id}`} className="font-mono font-semibold text-stone-800 hover:text-saffron-600">{r.receiptNumber}</Link>
                      </td>
                      <td className="px-5 py-3 text-stone-700">{r.donation?.donorName ?? '—'}</td>
                      <td className="px-5 py-3 font-bold text-stone-900">{formatINR(r.donation?.amount ?? 0)}</td>
                      <td className="px-5 py-3"><Badge color={r.status === 'ACTIVE' ? 'green' : 'red'}>{r.status}</Badge></td>
                      <td className="px-5 py-3 text-stone-500">{timeAgo(r.generatedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {r.status === 'ACTIVE' && (
                          <button onClick={() => downloadReceiptPdf(r.id)} className="btn-outline px-2.5 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> PDF</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3"><Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
          </>
        )}
      </Card>
    </AppLayout>
  )
}