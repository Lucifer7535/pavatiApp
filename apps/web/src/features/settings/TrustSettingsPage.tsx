import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Settings, Upload, Copy, Check, AlertTriangle } from 'lucide-react'
import { JOIN_MODE } from '@pavati/shared'
import { api, uploadFile } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, CardHeader, Input, Select, Textarea, Badge, Spinner, PageHeader } from '../../components/ui'
import { useActiveTrust, useAuth } from '../../lib/stores/auth'
import { fileToDataUrl } from '../../lib/utils'
import FestivalPicker from '../../components/FestivalPicker'

export default function TrustSettingsPage() {
  const active = useActiveTrust()!
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [trust, setTrust] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [confirmName, setConfirmName] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  const canManageFinances =
    active.role === 'PRIMARY_ADMIN' || active.role === 'ADMIN' || active.role === 'TREASURER'

  const fyInfo = useQuery({
    queryKey: ['financial-years', active.trustId],
    enabled: canManageFinances,
    queryFn: async () => api.get<any>(`/trusts/${active.trustId}/financial-years`),
  })

  const closeYear = useMutation({
    mutationFn: () => api.post(`/trusts/${active.trustId}/financial-years/close`, {}),
    onSuccess: () => {
      toast.success('Financial year closed. The new year starts from zero.')
      setConfirmClose(false)
      qc.invalidateQueries({ queryKey: ['trust', active.trustId] })
      qc.invalidateQueries({ queryKey: ['financial-years', active.trustId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  useQuery({
    queryKey: ['trust', active.trustId],
    queryFn: async () => {
      const t = await api.get<any>(`/trusts/${active.trustId}`)
      setTrust(t)
      setForm({
        name: t.name, description: t.description ?? '', registrationNumber: t.registrationNumber ?? '',
        city: t.city ?? '', state: t.state ?? '', pinCode: t.pinCode ?? '', address: t.address ?? '',
        contactPhone: t.contactPhone ?? '', contactEmail: t.contactEmail ?? '', website: t.website ?? '',
        upiId: t.upiId ?? '', financialYear: t.financialYear ?? '', joinMode: t.joinMode,
        festivalTypes: t.festivalTypes,
        financialYearStartDate: t.financialYearStartDate?.slice(0, 10) ?? '',
        financialYearEndDate: t.financialYearEndDate?.slice(0, 10) ?? '',
      })
      return t
    },
  })

  const save = useMutation({
    mutationFn: () => api.patch(`/trusts/${active.trustId}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trust', active.trustId] }); toast.success('Settings saved') },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteTrust = useMutation({
    mutationFn: () => api.del(`/trusts/${active.trustId}`),
    onSuccess: async () => {
      toast.success('Trust deleted permanently')
      qc.clear()
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      useAuth.getState().setSession(me)
      navigate('/onboarding')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const res = await uploadFile(dataUrl)
    setForm({ ...form, logoUrl: res.url })
    toast.success('Logo uploaded — save to apply')
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(trust.joinCode)
    setCopied(true)
    toast.success('Join code copied')
    setTimeout(() => setCopied(false), 1500)
  }

  if (!trust) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <PageHeader title="Trust Settings" subtitle={`Manage ${trust.name}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Basic details" />
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-saffron-100 text-2xl">
                {form.logoUrl ?? trust.logoUrl ? <img src={form.logoUrl ?? trust.logoUrl} alt="" className="h-full w-full object-cover" /> : trust.name[0]}
              </div>
              <label className="cursor-pointer"><span className="btn-outline"><Upload className="h-4 w-4" /> Change logo</span><input type="file" accept="image/*" className="hidden" onChange={onLogo} /></label>
            </div>
            <div><label className="label">Trust name</label><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Description</label><Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Registration no.</label><Input value={form.registrationNumber ?? ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></div>
              <div><label className="label">UPI ID</label><Input value={form.upiId ?? ''} onChange={(e) => setForm({ ...form, upiId: e.target.value })} /></div>
              <div />
            </div>
            <div className="rounded-xl bg-stone-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Financial year</p>
                  <p className="text-sm font-semibold text-stone-800">{form.financialYear || 'Indian financial year (1 Apr – 31 Mar)'}</p>
                </div>
                <Badge color="saffron">Starts fresh at close</Badge>
              </div>
              <p className="mt-1 text-xs text-stone-500">Dashboard totals and reports reset to the current window. Donations dated in a closed year are blocked unless an operator has post-closing adjustment permission.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div><label className="label text-xs">Starts on</label><Input type="date" value={form.financialYearStartDate ?? ''} onChange={(e) => setForm({ ...form, financialYearStartDate: e.target.value })} /></div>
                <div><label className="label text-xs">Ends on</label><Input type="date" value={form.financialYearEndDate ?? ''} onChange={(e) => setForm({ ...form, financialYearEndDate: e.target.value })} /></div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Join code" />
            <div className="p-6">
              <div className="rounded-xl bg-stone-50 p-4 text-center">
                <p className="font-mono text-2xl font-bold tracking-widest text-saffron-600">{trust.joinCode}</p>
                <p className="mt-1 text-xs text-stone-400">Trust code: {trust.uniqueCode}</p>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={copyCode}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy join code'}</Button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Membership" />
            <div className="p-6">
              <label className="label">Join mode</label>
              <Select value={form.joinMode ?? 'OPEN'} onChange={(e) => setForm({ ...form, joinMode: e.target.value })}>
                <option value="OPEN">Open — join with code</option>
                <option value="APPROVAL">Approval required</option>
                <option value="INVITE_ONLY">Invite only</option>
              </Select>
              <p className="mt-2 text-xs text-stone-400"><Badge color="saffron">{active.role}</Badge> You joined as {active.role.replace(/_/g, ' ').toLowerCase()}</p>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Contact & location" />
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="label">Contact phone</label><Input value={form.contactPhone ?? ''} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
          <div><label className="label">Contact email</label><Input value={form.contactEmail ?? ''} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div><label className="label">Website</label><Input value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div><label className="label">City</label><Input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">State</label><Input value={form.state ?? ''} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div><label className="label">PIN code</label><Input value={form.pinCode ?? ''} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="label">Address</label><Textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Festivals" />
        <div className="p-6">
          <FestivalPicker value={form.festivalTypes ?? []} onChange={(v) => setForm({ ...form, festivalTypes: v })} />
        </div>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button className="px-8" onClick={() => save.mutate()} loading={save.isPending}><Settings className="h-4 w-4" /> Save all settings</Button>
      </div>

      {canManageFinances && (
        <Card className="mt-6">
          <CardHeader title="Financial year" subtitle="Freeze the current period and start the next from ₹0" />
          <div className="p-6">
            {fyInfo.isLoading ? (
              <Spinner />
            ) : fyInfo.data?.canClose ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    Close financial year <span className="text-saffron-600">{fyInfo.data.current.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {fyInfo.data.current.startDate.slice(0, 10)} → {fyInfo.data.current.endDate.slice(0, 10)}. Snapshot totals are frozen; the dashboard and reports move to the next year. This cannot be undone.
                  </p>
                </div>
                {confirmClose ? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setConfirmClose(false)}>Cancel</Button>
                    <Button variant="danger" loading={closeYear.isPending} onClick={() => closeYear.mutate()}>Confirm close</Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmClose(true)}><AlertTriangle className="h-4 w-4" /> Close now</Button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-stone-800">
                  Current financial year: <span className="text-saffron-600">{fyInfo.data?.current.label ?? '—'}</span>
                </p>
                {fyInfo.data?.closed?.length ? (
                  <ul className="mt-3 space-y-2">
                    {fyInfo.data.closed.map((c: any) => (
                      <li key={c.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm">
                        <span className="font-medium text-stone-700">{c.year}</span>
                        <span className="text-stone-500">₹{c.totalAmount.toLocaleString('en-IN')} · {c.donationCount} donations · {c.donorCount} donors</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No closed years on record yet.</p>
                )}
                {!fyInfo.data?.canClose && <p className="mt-2 text-xs text-stone-400">Only an admin can close the financial year.</p>}
              </div>
            )}
          </div>
        </Card>
      )}

      {active.role === 'PRIMARY_ADMIN' && (
        <Card className="mt-6 border-red-200">
          <CardHeader title="Danger zone" />
          <div className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-stone-800">Delete this trust permanently</p>
                <p className="mt-1 text-xs text-stone-500">
                  This removes all donations, receipts, members, campaigns and announcements. Only you, as the trust creator, can do this. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder={`Type "${trust.name}" to confirm`}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="sm:max-w-xs"
              />
              <Button
                variant="danger"
                disabled={confirmName !== trust.name || deleteTrust.isPending}
                loading={deleteTrust.isPending}
                onClick={() => deleteTrust.mutate()}
              >
                Delete trust forever
              </Button>
            </div>
          </div>
        </Card>
      )}
    </AppLayout>
  )
}

void JOIN_MODE