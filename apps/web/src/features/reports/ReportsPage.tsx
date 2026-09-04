import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, TrendingUp, Wallet, Banknote, Filter, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { api, exportDonationsCsv, exportDonationsExcel } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, CardHeader, Spinner, Input, Select, StatCard, PageHeader, Button, Badge, Pagination } from '../../components/ui'
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
  memberCount: number
  byMode: { mode: string; amount: number; count: number }[]
  byCategory: { category: string; amount: number; count: number }[]
}

interface DetailedItem {
  id: string
  receiptNumber: string
  donationDate: string
  donorName: string
  phone: string
  email: string
  address: string
  amount: number
  paymentMode: string
  category: string
  collectorName: string
  status: string
  privacy: string
}

type SortKey = 'receiptNumber' | 'donationDate' | 'donorName' | 'amount' | 'paymentMode' | 'category' | 'collectorName'
type SortDir = 'asc' | 'desc'

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

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [addressContains, setAddressContains] = useState('')
  const [addressEquals, setAddressEquals] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [amountEquals, setAmountEquals] = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('')
  const [detailPage, setDetailPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('donationDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const detailFilters = useMemo(() => ({
    from: from || undefined,
    to: to || undefined,
    paymentMode: paymentModeFilter || undefined,
    receiptStatus: receiptStatusFilter || undefined,
    addressContains: addressContains || undefined,
    addressEquals: addressEquals || undefined,
    amountMin: amountMin || undefined,
    amountMax: amountMax || undefined,
    amountEquals: amountEquals || undefined,
    page: detailPage,
    pageSize: 50,
  }), [from, to, paymentModeFilter, receiptStatusFilter, addressContains, addressEquals, amountMin, amountMax, amountEquals, detailPage])

  const { data: detailed, isLoading: detailedLoading } = useQuery({
    queryKey: ['reports-detailed', active.trustId, detailFilters],
    queryFn: () => api.get<{ total: number; totalAmount: number; page: number; pageSize: number; items: DetailedItem[] }>(`/trusts/${active.trustId}/reports/detailed`, detailFilters as any),
  })

  const sortedItems = useMemo(() => {
    if (!detailed?.items) return []
    const items = [...detailed.items]
    items.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'amount') cmp = a.amount - b.amount
      else if (sortKey === 'donationDate') cmp = new Date(a.donationDate).getTime() - new Date(b.donationDate).getTime()
      else cmp = String(a[sortKey]).localeCompare(String(b[sortKey]))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [detailed?.items, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-stone-300" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-saffron-600" /> : <ArrowDown className="h-3 w-3 text-saffron-600" />
  }

  const hasActiveFilters = addressContains || addressEquals || amountMin || amountMax || amountEquals || paymentModeFilter || receiptStatusFilter

  function clearDetailFilters() {
    setAddressContains('')
    setAddressEquals('')
    setAmountMin('')
    setAmountMax('')
    setAmountEquals('')
    setPaymentModeFilter('')
    setReceiptStatusFilter('')
    setDetailPage(1)
  }

  const exportFilters = useMemo(() => ({
    from: from || undefined,
    to: to || undefined,
    paymentMode: paymentModeFilter || undefined,
    receiptStatus: receiptStatusFilter || undefined,
    addressContains: addressContains || undefined,
    addressEquals: addressEquals || undefined,
    amountMin: amountMin || undefined,
    amountMax: amountMax || undefined,
    amountEquals: amountEquals || undefined,
  }), [from, to, paymentModeFilter, receiptStatusFilter, addressContains, addressEquals, amountMin, amountMax, amountEquals])

  return (
    <AppLayout>
      <PageHeader
        title="Reports"
        subtitle="Track collections and performance"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportDonationsExcel(active.trustId, exportFilters).catch((e: any) => toast.error(e.message))}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button variant="outline" onClick={() => exportDonationsCsv(active.trustId, exportFilters).catch((e: any) => toast.error(e.message))}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

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

          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-stone-900">Detailed Report</h3>
                <p className="mt-0.5 text-sm text-stone-500">Donation records with donor details</p>
              </div>
              <div className="flex items-center gap-3">
                {detailed && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-stone-500"><span className="font-semibold text-stone-800">{detailed.total}</span> records</span>
                    <span className="text-stone-500">Total: <span className="font-semibold text-stone-800">{formatINR(detailed.totalAmount)}</span></span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={hasActiveFilters ? 'text-saffron-600' : ''}
                >
                  <Filter className="h-4 w-4" /> Filters
                  {hasActiveFilters && <Badge color="saffron" className="ml-1">Active</Badge>}
                  {filtersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {filtersOpen && (
              <div className="border-b border-stone-100 bg-stone-50/50 px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="label text-xs">Address Contains</label>
                    <Input placeholder="Partial address match" value={addressContains} onChange={(e) => { setAddressContains(e.target.value); setDetailPage(1) }} />
                  </div>
                  <div>
                    <label className="label text-xs">Address Equals</label>
                    <Input placeholder="Exact address match" value={addressEquals} onChange={(e) => { setAddressEquals(e.target.value); setDetailPage(1) }} />
                  </div>
                  <div>
                    <label className="label text-xs">{'Amount Min (>=)'}</label>
                    <Input type="number" placeholder="Minimum amount" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setAmountEquals(''); setDetailPage(1) }} />
                  </div>
                  <div>
                    <label className="label text-xs">{'Amount Max (<=)'}</label>
                    <Input type="number" placeholder="Maximum amount" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setAmountEquals(''); setDetailPage(1) }} />
                  </div>
                  <div>
                    <label className="label text-xs">Amount Equals (=)</label>
                    <Input type="number" placeholder="Exact amount" value={amountEquals} onChange={(e) => { setAmountEquals(e.target.value); setAmountMin(''); setAmountMax(''); setDetailPage(1) }} />
                  </div>
                  <div>
                    <label className="label text-xs">Payment Mode</label>
                    <Select value={paymentModeFilter} onChange={(e) => { setPaymentModeFilter(e.target.value); setDetailPage(1) }}>
                      <option value="">All modes</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="MIXED">Mixed</option>
                    </Select>
                  </div>
                  <div>
                    <label className="label text-xs">Receipt Status</label>
                    <Select value={receiptStatusFilter} onChange={(e) => { setReceiptStatusFilter(e.target.value); setDetailPage(1) }}>
                      <option value="">All statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="VOID">Void</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearDetailFilters}>Clear Filters</Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detailedLoading ? <Spinner /> : !detailed || sortedItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-400">No records match the current filters</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                        {([
                          ['receiptNumber', 'Receipt No'],
                          ['donationDate', 'Date'],
                          ['donorName', 'Donor'],
                          ['amount', 'Amount'],
                          ['paymentMode', 'Mode'],
                          ['category', 'Category'],
                          ['collectorName', 'Collector'],
                        ] as [SortKey, string][]).map(([key, label]) => (
                          <th key={key} className="cursor-pointer select-none px-4 py-3 hover:text-stone-600" onClick={() => handleSort(key)}>
                            <span className="inline-flex items-center gap-1">{label} <SortIcon col={key} /></span>
                          </th>
                        ))}
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedItems.map((d) => (
                        <tr key={d.id} className="hover:bg-stone-50">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-stone-800">{d.receiptNumber || '—'}</td>
                          <td className="px-4 py-2.5 text-stone-600">{new Date(d.donationDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-2.5 font-medium text-stone-800">{d.donorName}</td>
                          <td className="px-4 py-2.5 font-bold text-stone-900">{formatINR(d.amount)}</td>
                          <td className="px-4 py-2.5"><Badge color={d.paymentMode === 'CASH' ? 'green' : d.paymentMode === 'UPI' ? 'blue' : 'purple'}>{d.paymentMode}</Badge></td>
                          <td className="px-4 py-2.5 text-stone-600">{d.category}</td>
                          <td className="px-4 py-2.5 text-stone-600">{d.collectorName || '—'}</td>
                          <td className="px-4 py-2.5 text-stone-500">{d.phone || '—'}</td>
                          <td className="px-4 py-2.5 text-stone-500">{d.email || '—'}</td>
                          <td className="px-4 py-2.5 max-w-[200px] truncate text-stone-500" title={d.address}>{d.address || '—'}</td>
                          <td className="px-4 py-2.5"><Badge color={d.status === 'SUCCEEDED' ? 'green' : 'red'}>{d.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3">
                  <Pagination page={detailed.page} pageSize={detailed.pageSize} total={detailed.total} onPage={setDetailPage} />
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </AppLayout>
  )
}
