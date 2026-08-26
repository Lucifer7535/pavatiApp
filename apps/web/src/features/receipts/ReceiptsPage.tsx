import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Download, Send, MessageCircle, Mail } from 'lucide-react'
import { api, downloadReceiptPdf } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Card, Badge, Spinner, Input, Select, Pagination, EmptyState, PageHeader } from '../../components/ui'
import { formatINR, timeAgo } from '../../lib/utils'
import { useActiveTrust } from '../../lib/stores/auth'

function buildReceiptMessage(amount: number, receiptNumber: string, token: string): string {
  const origin = window.location.origin
  return [
    `Thank you for your contribution.`,
    `Donation Amount: ${formatINR(amount)}`,
    `Receipt No: ${receiptNumber}`,
    `View your receipt: ${origin}/receipt/verify/${token}`,
  ].join('\n')
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const text = encodeURIComponent(message)
  return digits ? `https://wa.me/91${digits}?text=${text}` : `https://wa.me/?text=${text}`
}

function SendPopover({ receipt, channels, onSend }: { receipt: any; channels: string[]; onSend: (receiptId: string, channels: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (ch: string) => setChecked((p) => ({ ...p, [ch]: !p[ch] }))
  const selected = channels.filter((ch) => checked[ch])

  if (channels.length === 0) return null

  if (channels.length === 1) {
    const ch = channels[0]
    if (ch === 'whatsapp') {
      return (
        <button onClick={() => {
          const msg = buildReceiptMessage(receipt.donation.amount, receipt.receiptNumber, receipt.verificationToken)
          window.open(buildWhatsAppUrl(receipt.donation.phone, msg), '_blank')
        }} className="btn-outline px-2.5 py-1.5 text-xs">
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </button>
      )
    }
    return (
      <button onClick={() => onSend(receipt.id, [ch])} className="btn-outline px-2.5 py-1.5 text-xs">
        <Mail className="h-3.5 w-3.5" /> Email
      </button>
    )
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(!open)} className="btn-outline px-2.5 py-1.5 text-xs">
        <Send className="h-3.5 w-3.5" /> Send
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-stone-600">Send receipt via</p>
          {channels.includes('whatsapp') && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-stone-50">
              <input type="checkbox" checked={!!checked.whatsapp} onChange={() => toggle('whatsapp')} className="h-3.5 w-3.5 rounded border-stone-300 text-green-600 focus:ring-green-500" />
              <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
            </label>
          )}
          {channels.includes('email') && (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-stone-50">
              <input type="checkbox" checked={!!checked.email} onChange={() => toggle('email')} className="h-3.5 w-3.5 rounded border-stone-300 text-purple-600 focus:ring-purple-500" />
              <Mail className="h-3.5 w-3.5 text-purple-600" /> Email
            </label>
          )}
          <button
            disabled={selected.length === 0}
            onClick={() => { onSend(receipt.id, selected); setOpen(false); setChecked({}) }}
            className="mt-2 w-full rounded-lg bg-saffron-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-saffron-700 disabled:opacity-40"
          >
            Send ({selected.length})
          </button>
        </div>
      )}
    </div>
  )
}

export default function ReceiptsPage() {
  const active = useActiveTrust()!
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', active.trustId, page, q, status],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: any[] }>(`/trusts/${active.trustId}/receipts`, { page, pageSize: 20, status: status || undefined }),
  })

  const { data: settings } = useQuery({
    queryKey: ['notification-settings', active.trustId],
    queryFn: () => api.get<{ notificationWhatsapp: boolean; notificationEmail: boolean }>(`/trusts/${active.trustId}/notifications/settings`),
  })

  const sendMutation = useMutation({
    mutationFn: ({ receiptId, channels }: { receiptId: string; channels: string[] }) =>
      api.post<{ sent: string[] }>(`/trusts/${active.trustId}/receipts/${receiptId}/send`, { channels }),
    onSuccess: (res) => { if (res.sent.length) toast.success(`Sent via ${res.sent.join(', ')}`) },
    onError: (e: any) => toast.error(e.message),
  })

  const filtered = data?.items.filter((r) => !q || r.receiptNumber.toLowerCase().includes(q.toLowerCase()) || r.donation?.donorName.toLowerCase().includes(q.toLowerCase()))

  function getActiveChannels(r: any): string[] {
    if (!settings || r.status !== 'ACTIVE') return []
    const channels: string[] = []
    if (settings.notificationWhatsapp && r.donation?.phone) channels.push('whatsapp')
    if (settings.notificationEmail && r.donation?.email) channels.push('email')
    return channels
  }

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
                  {filtered!.map((r) => {
                    const channels = getActiveChannels(r)
                    return (
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
                            <div className="flex items-center justify-end gap-1.5">
                              {channels.length > 0 && (
                                <SendPopover
                                  receipt={r}
                                  channels={channels}
                                  onSend={(id, ch) => {
                                    const whatsapp = ch.includes('whatsapp')
                                    const email = ch.includes('email')
                                    if (whatsapp) {
                                      const msg = buildReceiptMessage(r.donation.amount, r.receiptNumber, r.verificationToken)
                                      window.open(buildWhatsAppUrl(r.donation.phone, msg), '_blank')
                                    }
                                    if (email) sendMutation.mutate({ receiptId: id, channels: ['email'] })
                                  }}
                                />
                              )}
                              <button onClick={() => downloadReceiptPdf(r.id)} className="btn-outline px-2.5 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> PDF</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
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
