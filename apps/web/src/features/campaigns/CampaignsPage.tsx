import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2, Plus, QrCode, Copy, Power, Trash2, ExternalLink, Upload } from 'lucide-react'
import { api, uploadFile } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, Input, Select, Textarea, Badge, Spinner, Modal, EmptyState, PageHeader } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { formatINR, fileToDataUrl } from '../../lib/utils'
import { categoryOptions, useTrustFestivals } from '../../lib/festivals'

interface QrModalState {
  id: string
  name: string
  paymentUrl: string
  qrCodeUrl: string | null
}

const EMPTY_FORM = { name: '', description: '', category: 'General Donation', suggestedAmounts: '', qrCodeUrl: '' }

export default function CampaignsPage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const festivals = useTrustFestivals(active.trustId)
  const [open, setOpen] = useState(false)
  const [qrModal, setQrModal] = useState<QrModalState | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/campaigns`),
  })

  const create = useMutation({
    mutationFn: () => api.post<any>(`/trusts/${active.trustId}/campaigns`, {
      name: form.name,
      description: form.description || undefined,
      category: form.category,
      suggestedAmounts: form.suggestedAmounts.split(',').map((s) => Number(s.trim())).filter(Boolean),
      qrCodeUrl: form.qrCodeUrl || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['campaigns', active.trustId] })
      setOpen(false)
      setForm({ ...EMPTY_FORM })
      setQrModal({ id: res.id, name: res.name, paymentUrl: res.paymentUrl, qrCodeUrl: res.qrCodeUrl ?? null })
      toast.success('Payment link created')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const replaceQr = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => api.patch(`/trusts/${active.trustId}/campaigns/${id}`, { qrCodeUrl: url }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['campaigns', active.trustId] })
      setQrModal((m) => (m && m.id === vars.id ? { ...m, qrCodeUrl: vars.url } : m))
      toast.success('Payment QR updated')
    },
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

  const onFormQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadFile(await fileToDataUrl(file))
      setForm((f) => ({ ...f, qrCodeUrl: res.url }))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const onCampaignQr = async (e: React.ChangeEvent<HTMLInputElement>, target: { id: string }) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadFile(await fileToDataUrl(file))
      replaceQr.mutate({ id: target.id, url: res.url })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

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
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setQrModal({ id: c.id, name: c.name, paymentUrl: c.paymentUrl, qrCodeUrl: c.qrCodeUrl ?? null })}><QrCode className="h-3.5 w-3.5" /> {c.qrCodeUrl ? 'QR' : 'Set QR'}</Button>
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
          <div>
            <label className="label">Payment QR code <span className="text-stone-400">(your UPI QR)</span></label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {form.qrCodeUrl ? <img src={form.qrCodeUrl} alt="" className="h-full w-full object-contain" /> : <QrCode className="h-5 w-5 text-stone-300" />}
              </div>
              <label className="cursor-pointer"><span className="btn-outline"><Upload className="h-4 w-4" /> {form.qrCodeUrl ? 'Change' : 'Upload'}</span><input type="file" accept="image/*" className="hidden" onChange={onFormQr} /></label>
            </div>
            <p className="mt-1 text-xs text-stone-400">Donors scan this QR on this link's donation page.</p>
          </div>
          <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()} disabled={!form.name.trim()}>Create link</Button>
        </div>
      </Modal>

      <Modal open={!!qrModal} onClose={() => setQrModal(null)} title={qrModal ? `Payment QR — ${qrModal.name}` : 'Payment QR'}>
        {qrModal?.qrCodeUrl ? (
          <div className="text-center">
            <div className="mx-auto w-fit rounded-2xl border border-stone-200 bg-white p-4">
              <img src={qrModal.qrCodeUrl} alt="Payment QR code" className="h-52 w-52 object-contain" />
            </div>
            <p className="mt-3 break-all text-xs text-stone-500">{qrModal.paymentUrl}</p>
            <div className="mt-4 grid gap-2">
              <Button onClick={() => { navigator.clipboard.writeText(qrModal.paymentUrl); toast.success('Copied!') }}>Copy donation page link</Button>
              <label className="cursor-pointer"><span className="btn-outline flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold"><Upload className="h-4 w-4" /> Replace QR</span><input type="file" accept="image/*" className="hidden" onChange={(e) => onCampaignQr(e, qrModal)} /></label>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<QrCode className="h-6 w-6" />}
            title="No payment QR yet"
            description="Upload your bank or UPI app QR code for this payment link — donors will scan it on the donation page."
            action={qrModal && (
              <label className="cursor-pointer"><span className="btn-primary inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Upload QR</span><input type="file" accept="image/*" className="hidden" onChange={(e) => onCampaignQr(e, qrModal)} /></label>
            )}
          />
        )}
      </Modal>
    </AppLayout>
  )
}
