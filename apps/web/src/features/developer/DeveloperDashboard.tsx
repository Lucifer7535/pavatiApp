import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Landmark, UserPlus, Wallet, ReceiptText, Link2, Megaphone, DoorOpen,
  RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import { Button, Card, CardHeader, Spinner, StatCard, Badge, Input, EmptyState, PageHeader } from '../../components/ui'
import { formatINR } from '../../lib/utils'
import { getDevToken } from '../../lib/dev-auth'
import DeveloperLayout from './DeveloperLayout'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0284c7']

interface DonationStatus {
  status: string
  count: number
  totalAmount: number
}

interface TrustRow {
  id: string
  name: string
  memberCount: number
  donationCount: number
  totalAmount: number
}

interface StatPayload {
  summary: {
    totalUsers: number
    totalTrusts: number
    totalMembers: number
    totalDonations: number
    totalDonationAmount: number
    totalReceipts: number
    totalCampaigns: number
    totalAnnouncements: number
    totalJoinRequests: number
    pendingJoinRequests: number
  }
  donationByStatus: DonationStatus[]
  usersByDay: { date: string; count: number }[]
  trustsByDay: { date: string; count: number }[]
  trustBreakdown: TrustRow[]
  recentUsers: { id: string; name: string; email: string | null; phone: string | null; createdAt: string }[]
}

type SortKey = 'name' | 'memberCount' | 'donationCount' | 'totalAmount'
type SortDir = 'asc' | 'desc'

const statusLabel: Record<string, string> = { SUCCEEDED: 'Successful', PENDING: 'Pending', CANCELLED: 'Cancelled' }
const statusColor: Record<string, string> = { SUCCEEDED: 'green', PENDING: 'gold', CANCELLED: 'red' }

export default function DeveloperDashboard() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalAmount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dev-stats', from, to],
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString() ? `?${params}` : ''
      return fetch(`/api/v1/dev/stats${qs}`, {
        headers: { Authorization: `Bearer ${getDevToken()}` },
      }).then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error ?? 'Failed to load stats')
        return body.data as StatPayload
      })
    },
  })

  const sortedTrusts = useMemo(() => {
    if (!data?.trustBreakdown) return []
    return [...data.trustBreakdown].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'memberCount') cmp = a.memberCount - b.memberCount
      else if (sortKey === 'donationCount') cmp = a.donationCount - b.donationCount
      else cmp = a.totalAmount - b.totalAmount
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data?.trustBreakdown, sortKey, sortDir])

  const donationsByTrust = useMemo(
    () => sortedTrusts.slice(0, 10).map((t) => ({ name: t.name, donations: t.donationCount })),
    [sortedTrusts]
  )

  const amountByTrust = useMemo(
    () => sortedTrusts.slice(0, 10).map((t) => ({ name: t.name, amount: t.totalAmount })),
    [sortedTrusts]
  )

  const pieData = useMemo(
    () =>
      (data?.donationByStatus ?? []).map((d) => ({
        name: statusLabel[d.status] ?? d.status,
        value: d.count,
      })),
    [data?.donationByStatus]
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-stone-300" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-saffron-600" /> : <ArrowDown className="h-3 w-3 text-saffron-600" />
  }

  async function exportJson() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `platform-analytics-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const s = data?.summary
  const byStatus = data?.donationByStatus ?? []

  const getStatus = (st: string) => byStatus.find((d) => d.status === st)

  return (
    <DeveloperLayout>
      <PageHeader
        title="Platform Overview"
        subtitle="Aggregate activity across all users, trusts, and donations"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div>
                <label className="label text-xs">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="label text-xs">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              {(from || to) && (
                <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>Clear</Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={!data}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-stone-500">Could not load platform analytics.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {isLoading || !s ? (
        <Spinner label="Loading platform analytics…" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Users Signed Up" value={s.totalUsers} icon={<Users className="h-5 w-5" />} accent="saffron" sub="registered accounts" />
            <StatCard label="Trusts Created" value={s.totalTrusts} icon={<Landmark className="h-5 w-5" />} accent="maroon" sub="public trusts" />
            <StatCard label="Trust Members" value={s.totalMembers} icon={<UserPlus className="h-5 w-5" />} accent="blue" sub="across all trusts" />
            <StatCard label="Donations" value={s.totalDonations} icon={<Wallet className="h-5 w-5" />} accent="green" sub={formatINR(s.totalDonationAmount)} />
            <StatCard label="Receipts Issued" value={s.totalReceipts} icon={<ReceiptText className="h-5 w-5" />} accent="gold" sub="generated" />
            <StatCard label="Payment Campaigns" value={s.totalCampaigns} icon={<Link2 className="h-5 w-5" />} accent="purple" sub="active links" />
            <StatCard label="Announcements" value={s.totalAnnouncements} icon={<Megaphone className="h-5 w-5" />} accent="saffron" sub="published" />
            <StatCard label="Join Requests" value={s.totalJoinRequests} icon={<DoorOpen className="h-5 w-5" />} accent="maroon" sub={`${s.pendingJoinRequests} pending`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Donation Status" subtitle="Distribution by status" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {(['SUCCEEDED', 'PENDING', 'CANCELLED'] as const).map((st) => {
                  const row = getStatus(st)
                  return (
                    <div key={st} className="rounded-xl border border-stone-100 p-4">
                      <div className="flex items-center justify-between">
                        <Badge color={statusColor[st]}>{statusLabel[st]}</Badge>
                        <span className="text-lg font-bold text-stone-900">{row?.count ?? 0}</span>
                      </div>
                      <p className="mt-1 text-sm text-stone-500">{formatINR(row?.totalAmount ?? 0)}</p>
                    </div>
                  )
                })}
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <Badge color="default">Total</Badge>
                    <span className="text-lg font-bold text-stone-900">{s.totalDonations}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-stone-700">{formatINR(s.totalDonationAmount)}</p>
                </div>
                <div className="h-52 sm:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => `${e.name}`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="User Sign-ups" subtitle="Daily registration trend" />
                <div className="h-52 p-4">
                  {(data?.usersByDay?.length ?? 0) === 0 ? (
                    <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No sign-ups yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.usersByDay ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} name="Users" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader title="Trust Creation" subtitle="Daily trust registration trend" />
                <div className="h-52 p-4">
                  {(data?.trustsByDay?.length ?? 0) === 0 ? (
                    <EmptyState icon={<Landmark className="h-6 w-6" />} title="No trusts created yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.trustsByDay ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#9f1239" radius={[4, 4, 0, 0]} name="Trusts" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Donations by Trust" subtitle="Top 10 trusts by donation count" />
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={donationsByTrust} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={170} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)} />
                    <Tooltip />
                    <Bar dataKey="donations" fill="#d4af37" radius={[0, 4, 4, 0]} name="Donations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Donation Amount by Trust" subtitle="Top 10 trusts by total value" />
              <div className="h-64 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={amountByTrust} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={170} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 22)}…` : v)} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Bar dataKey="amount" fill="#0d9488" radius={[0, 4, 4, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-stone-900">Trust-wise Donation Breakdown</h3>
                <p className="mt-0.5 text-sm text-stone-500">Performance of every trust on the platform</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <span className="font-semibold text-stone-800">{sortedTrusts.length}</span> trusts
              </div>
            </div>

            {sortedTrusts.length === 0 ? (
              <EmptyState icon={<Landmark className="h-6 w-6" />} title="No trusts yet" description="Trusts will appear here once they are created." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                      {([
                        ['name', 'Trust Name'],
                        ['memberCount', 'Members'],
                        ['donationCount', 'Donations'],
                        ['totalAmount', 'Total Amount'],
                      ] as [SortKey, string][]).map(([key, label]) => (
                        <th key={key} className="cursor-pointer select-none px-4 py-3 hover:text-stone-600" onClick={() => handleSort(key)}>
                          <span className="inline-flex items-center gap-1">{label} <SortIcon col={key} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sortedTrusts.map((t) => (
                      <tr key={t.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2.5 font-medium text-stone-800">{t.name}</td>
                        <td className="px-4 py-2.5 text-stone-600">{t.memberCount}</td>
                        <td className="px-4 py-2.5 text-stone-600">{t.donationCount}</td>
                        <td className="px-4 py-2.5 font-bold text-stone-900">{formatINR(t.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent Users" subtitle="Latest sign-ups on the platform" />
            <div className="divide-y divide-stone-100">
              {data?.recentUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-stone-400">No users yet</p>}
              {data?.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron-100 text-xs font-bold text-saffron-700">
                    {u.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800">{u.name}</p>
                    <p className="truncate text-xs text-stone-400">{u.email ?? u.phone ?? '—'}</p>
                  </div>
                  <p className="shrink-0 text-xs text-stone-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </DeveloperLayout>
  )
}