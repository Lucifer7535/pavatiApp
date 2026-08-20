import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2, Plus, QrCode, Copy, Power, Trash2, ExternalLink } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, Input, Select, Textarea, Badge, Spinner, Modal, EmptyState, PageHeader } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { formatINR } from '../../lib/utils'
import { categoryOptions, useTrustFestivals } from '../../lib/festivals'

export default function CampaignsPage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const festivals = useTrustFestivals(active.trustId)
  const [open, setOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: 'General Donation', suggestedAmounts: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/campaigns`),
  })

  const create = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string }>(`/trusts/${active.trustId}/campaigns`, {
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      suggestedAmounts: form.suggestedAmounts.split(',').map((s) => Number(s.trim())).filter(Boolean),
    }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['campaigns', active.trustId] }); setOpen(false); setQrUrl(res.paymentUrl); toast.success('Payment link created') },
    onError: (e: any) => toast.error(e.message),
  })

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/trusts/${active.trustId}/campaigns/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns', active.trustId] }); toast.success('Updated') },
    onError: (e: any) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/trusts/${active.trustId}/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns', active.trustId] }); toast.success('Deleted') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppLayout>
      <PageHeader title="Payment Links" subtitle="Online donation pages and QR codes" action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New link</Button>} />
      {isLoading || !data ? <Spinner /> : data.length === 0 ? (
        <Card><EmptyState icon={<Link2 className="h-6 w-6" />} title="No payment links yet" description="Create a festive donation page donors can share." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New link</Button>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600"><Link2 className="h-5 w-5" /></div>
                <Badge color={c.active ? 'green' : 'default'}>{c.active ? 'Live' : 'Paused'}</Badge>
              </div>
              <h3 className="mt-3 font-semibold text-stone-900">{c.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-stone-500">{c.description ?? c.category ?? 'Donation campaign'}</p>
              <p className="mt-2 text-sm text-stone-600">{formatINR(c.donationCount ?? 0)} donations</p>
              <div className="mt-3 break-all rounded-lg bg-stone-50 p-2 font-mono text-[10px] text-stone-500">{c.paymentUrl}</div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setQrUrl(c.paymentUrl)}><QrCode className="h-3.5 w-3.5" /> QR</Button>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.paymentUrl); toast.success('Link copied') }}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(c.id)}><Power className={`h-3.5 w-3.5 ${c.active ? 'text-emerald-500' : 'text-stone-400'}`} /></Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm('Delete this campaign?') && del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <a href={`/donate/${c.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-semibold text-saffron-600 hover:underline"><ExternalLink className="h-3 w-3" /> Open donate page</a>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create a payment link">
        <div className="space-y-3">
          <div><label className="label">Campaign name *</label><Input placeholder="e.g. Ganpati Visarjan Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
          <div><label className="label">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Category</label>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions(festivals).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div><label className="label">Suggested amounts <span className="text-stone-400">(comma separated)</span></label><Input placeholder="51, 101, 501, 1001" value={form.suggestedAmounts} onChange={(e) => setForm({ ...form, suggestedAmounts: e.target.value })} /></div>
          <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()} disabled={!form.name.trim()}>Create link</Button>
        </div>
      </Modal>

      <Modal open={!!qrUrl} onClose={() => setQrUrl(null)} title="Scan to donate">
        <div className="text-center">
          <div className="mx-auto w-fit rounded-2xl border border-stone-200 bg-white p-4">
            {qrUrl && <QRCodeSVG value={qrUrl} size={220} fgColor="#7f1d1d" />}
          </div>
          <p className="mt-3 break-all text-xs text-stone-500">{qrUrl}</p>
          <Button className="mt-4 w-full" onClick={() => { navigator.clipboard.writeText(qrUrl!); toast.success('Copied!') }}>Copy link</Button>
        </div>
      </Modal>
    </AppLayout>
  )
}