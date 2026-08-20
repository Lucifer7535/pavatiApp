import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Wallet, Users, TrendingUp, Clock, PlusCircle, Megaphone, Link2, ReceiptText } from 'lucide-react'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Spinner, StatCard, Badge, EmptyState, Button } from '../../components/ui'
import { formatINR, timeAgo, cn } from '../../lib/utils'
import { PAYMENT_MODE_LABELS } from '@pavati/shared'

interface Dashboard {
  totalCollected: number
  totalDonors: number
  cashCollected: number
  upiCollected: number
  onlineCollected: number
  todayCollected: number
  pendingCount: number
  memberCount: number
  recentTransactions: any[]
  recentMembers: { id: string; name: string; role: string; profileImage: string | null; joinedAt: string }[]
  campaigns: any[]
}

const modeColor: Record<string, string> = { CASH: 'bg-emerald-100 text-emerald-700', UPI: 'bg-sky-100 text-sky-700', ONLINE: 'bg-purple-100 text-purple-700', BANK_TRANSFER: 'bg-blue-100 text-blue-700', CARD: 'bg-amber-100 text-amber-700', OTHER: 'bg-stone-100 text-stone-600' }

export default function TrustDashboard({ trustId }: { trustId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', trustId],
    queryFn: () => api.get<Dashboard>(`/trusts/${trustId}/dashboard`),
  })

  if (isError) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-stone-500">Could not load the dashboard.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {isLoading || !data ? <Spinner /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total collected" value={formatINR(data.totalCollected)} icon={<TrendingUp className="h-5 w-5" />} accent="saffron" sub={`${data.totalDonors} donors`} />
            <StatCard label="Today" value={formatINR(data.todayCollected)} icon={<Clock className="h-5 w-5" />} accent="gold" sub="since midnight" />
            <StatCard label="Cash / UPI" value={`${formatINR(data.cashCollected)} / ${formatINR(data.upiCollected)}`} icon={<Wallet className="h-5 w-5" />} accent="green" />
            <StatCard label="Members" value={data.memberCount} icon={<Users className="h-5 w-5" />} accent="maroon" sub={`${data.pendingCount} pending donations`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Recent donations" action={<Link to="/app/donations" className="text-sm font-semibold text-saffron-600 hover:underline">View all</Link>} />
              {data.recentTransactions.length === 0 ? (
                <EmptyState icon={<Wallet className="h-6 w-6" />} title="No donations yet" description="Create your first Pāvati to get started." action={<Link to="/app/donations/new" className="btn-primary"><PlusCircle className="h-4 w-4" /> New Pāvati</Link>} />
              ) : (
                <div className="divide-y divide-stone-100">
                  {data.recentTransactions.map((d) => (
                    <Link key={d.id} to={`/app/donations/${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: ['#f97316', '#9f1239', '#047857', '#7c3aed'][d.amount % 4] }}>
                        {d.donorName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">{d.donorName}</p>
                        <p className="text-xs text-stone-400">{d.category} · {timeAgo(d.donationDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-stone-900">{formatINR(d.amount)}</p>
                        <Badge color={modeColor[d.paymentMode]?.includes('emerald') ? 'green' : modeColor[d.paymentMode]?.includes('sky') ? 'blue' : modeColor[d.paymentMode]?.includes('purple') ? 'purple' : 'gold'}>{(PAYMENT_MODE_LABELS as Record<string, string>)[d.paymentMode] ?? d.paymentMode}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title="Campaigns" action={<Link to="/app/campaigns" className="text-sm font-semibold text-saffron-600 hover:underline">Manage</Link>} />
                <div className="space-y-2 p-4">
                  {data.campaigns.length === 0 && <p className="py-2 text-center text-sm text-stone-400">No campaigns yet</p>}
                  {data.campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-stone-100 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Link2 className={cn('h-4 w-4', c.active ? 'text-emerald-500' : 'text-stone-300')} />
                        <span className="font-medium text-stone-800">{c.name}</span>
                      </div>
                      <Badge color={c.active ? 'green' : 'default'}>{c.active ? 'Live' : 'Inactive'}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Recent members" />
                <div className="divide-y divide-stone-100">
                  {data.recentMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-saffron-100 text-xs font-bold text-saffron-700">
                        {m.profileImage ? <img src={m.profileImage} alt="" className="h-full w-full object-cover" /> : m.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-800">{m.name}</p>
                        <p className="text-[11px] text-stone-400">{m.role.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/app/donations/new" className="card group flex items-center gap-3 p-4 hover:border-saffron-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600 group-hover:bg-saffron-500 group-hover:text-white transition-colors"><PlusCircle className="h-5 w-5" /></div>
              <div><p className="font-semibold text-stone-800">New Pāvati</p><p className="text-xs text-stone-500">Record an offline donation</p></div>
            </Link>
            <Link to="/app/announcements/new" className="card group flex items-center gap-3 p-4 hover:border-saffron-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon-100 text-maroon-600 group-hover:bg-maroon-700 group-hover:text-white transition-colors"><Megaphone className="h-5 w-5" /></div>
              <div><p className="font-semibold text-stone-800">Announce</p><p className="text-xs text-stone-500">Share a festive update</p></div>
            </Link>
            <Link to="/app/templates" className="card group flex items-center gap-3 p-4 hover:border-saffron-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-300/30 text-gold-500 group-hover:bg-gold-400 group-hover:text-white transition-colors"><ReceiptText className="h-5 w-5" /></div>
              <div><p className="font-semibold text-stone-800">Templates</p><p className="text-xs text-stone-500">Design your Pāvati</p></div>
            </Link>
          </div>
        </div>
      )}
    </AppLayout>
  )
}