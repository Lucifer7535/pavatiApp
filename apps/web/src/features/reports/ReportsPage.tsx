import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, TrendingUp, Wallet, Banknote, Smartphone } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Spinner, Input, StatCard, PageHeader, Button, Badge } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { formatINR } from '../../lib/utils'
import { PAYMENT_MODE_LABELS } from '@pavati/shared'

const COLORS = ['#f97316', '#9f1239', '#d4af37', '#0d9488', '#7c3aed', '#0284c7']

interface Summary {
  totalDonations: number
  totalCollected: number
  todayDonations: number
  todayCollected: number
  cashCollected: number
  upiCollected: number
  bankTransferCollected: number
  memberCount: number
  byMode: { mode: string; amount: number; count: number }[]
  byCategory: { category: string; amount: number; count: number }[]
}

export default function ReportsPage() {
  const active = useActiveTrust()!
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports-summary', active.trustId, from, to],
    queryFn: () => api.get<Summary>(`/trusts/${active.trustId}/reports/summary`, { from: from || undefined, to: to || undefined }),
  })

  const { data: daily } = useQuery({
    queryKey: ['reports-daily', active.trustId, from, to],
    queryFn: () => api.get<{ date: string; amount: number; count: number }[]>(`/trusts/${active.trustId}/reports/daily`, { from: from || undefined, to: to || undefined }),
  })

  const { data: collectors } = useQuery({
    queryKey: ['reports-collectors', active.trustId],
    queryFn: () => api.get<{ collectorId: string; collectorName: string; amount: number; count: number; role: string }[]>(`/trusts/${active.trustId}/reports/collectors`),
  })

  const exportCsv = () => {
    window.open(`/api/v1/trusts/${active.trustId}/reports/export`, '_blank')
  }

  return (
    <AppLayout>
      <PageHeader title="Reports" subtitle="Track collections and performance" action={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>} />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div><label className="label">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
        <div><label className="label">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
        {(from || to) && <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>Clear</Button>}
      </div>

      {isLoading || !summary ? <Spinner /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total collected" value={formatINR(summary.totalCollected)} icon={<TrendingUp className="h-5 w-5" />} accent="saffron" sub={`${summary.totalDonations} donations`} />
            <StatCard label="Today" value={formatINR(summary.todayCollected)} icon={<Wallet className="h-5 w-5" />} accent="gold" sub={`${summary.todayDonations} donations`} />
            <StatCard label="Cash / UPI" value={`${formatINR(summary.cashCollected)} / ${formatINR(summary.upiCollected)}`} icon={<Banknote className="h-5 w-5" />} accent="green" />
            <StatCard label="Bank Transfer" value={formatINR(summary.bankTransferCollected)} icon={<Smartphone className="h-5 w-5" />} accent="blue" sub={`${summary.memberCount} members`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Daily collections" />
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily ?? []}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                    <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="By payment mode" />
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.byMode} dataKey="amount" nameKey="mode" outerRadius={90} label={(e: any) => (PAYMENT_MODE_LABELS as Record<string, string>)[e.mode] ?? e.mode}>
                      {summary.byMode.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="By category" />
              <div className="p-4">
                {summary.byCategory.map((c, i) => (
                  <div key={c.category} className="mb-3">
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-stone-600">{c.category}</span><span className="text-stone-400">{formatINR(c.amount)} · {c.count}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, (c.amount / (summary.totalCollected || 1)) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Collector performance" />
              <div className="p-4">
                {(collectors ?? []).length === 0 && <p className="py-4 text-center text-sm text-stone-400">No offline collections yet</p>}
                {(collectors ?? []).map((c) => (
                  <div key={c.collectorId} className="mb-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-stone-600">{c.collectorName} <Badge color="saffron">{c.role}</Badge></span>
                      <span className="text-stone-400">{formatINR(c.amount)} · {c.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-maroon-600" style={{ width: `${Math.max(4, (c.amount / (summary.totalCollected || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </AppLayout>
  )
}

void BarChart3