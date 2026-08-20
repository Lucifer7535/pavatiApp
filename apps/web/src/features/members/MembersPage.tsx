import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, Users, Search, Mail, Shield } from 'lucide-react'
import { ROLE_LABELS, ROLE_ORDER, type TrustRole } from '@pavati/shared'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/layout'
import { Button, Card, Input, Select, Spinner, Badge, Modal, EmptyState, PageHeader } from '../../components/ui'
import { useActiveTrust } from '../../lib/stores/auth'
import { formatDate } from '../../lib/utils'

const memberStatusColor: Record<string, string> = { ACTIVE: 'green', INVITED: 'gold', PENDING_APPROVAL: 'gold', REMOVED: 'red' }

export default function MembersPage() {
  const active = useActiveTrust()!
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'MEMBER', position: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['members', active.trustId],
    queryFn: () => api.get<any[]>(`/trusts/${active.trustId}/members`),
  })

  const filtered = data?.filter((m) => !q || m.user.name.toLowerCase().includes(q.toLowerCase()) || m.role.toLowerCase().includes(q.toLowerCase()))

  const add = useMutation({
    mutationFn: () => api.post(`/trusts/${active.trustId}/members`, { ...form, role: form.role as TrustRole, phone: form.phone || undefined, email: form.email || undefined, name: form.name || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', active.trustId] }); setAddOpen(false); toast.success('Member added'); setForm({ name: '', email: '', phone: '', role: 'MEMBER', position: '' }) },
    onError: (e: any) => toast.error(e.message),
  })

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/trusts/${active.trustId}/members/${id}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', active.trustId] }); toast.success('Role updated') },
    onError: (e: any) => toast.error(e.message),
  })

  const invite = useMutation({
    mutationFn: () => api.post<{ inviteUrl: string }>(`/trusts/${active.trustId}/members/invite`, { email: form.email || undefined, phone: form.phone || undefined, role: 'MEMBER' }),
    onSuccess: (res) => { setInviteUrl(res.inviteUrl); setAddOpen(false); toast.success('Invitation created') },
    onError: (e: any) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/trusts/${active.trustId}/members/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members', active.trustId] }); toast.success('Member removed') },
    onError: (e: any) => toast.error(e.message),
  })

  const editMember = data?.find((m) => m.id === editId)

  return (
    <AppLayout>
      <PageHeader title="Members" subtitle={`${data?.length ?? 0} members in this trust`} action={<Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Add / invite</Button>} />
      <Card>
        <div className="flex items-center gap-2 border-b border-stone-100 p-4">
          <Search className="h-4 w-4 text-stone-400" />
          <Input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} className="border-0 focus:ring-0" />
        </div>
        {isLoading || !data ? <Spinner /> : filtered!.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members found" />
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered!.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-saffron-100 text-sm font-bold text-saffron-700">
                  {m.user.profileImage ? <img src={m.user.profileImage} alt="" className="h-full w-full object-cover" /> : m.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-800">{m.user.name} {m.position && <span className="text-xs font-normal text-stone-400">· {m.position}</span>}</p>
                  <p className="truncate text-xs text-stone-400">{m.user.email ?? m.user.phone ?? '—'} · joined {formatDate(m.joinedAt)}</p>
                </div>
                <Badge color={memberStatusColor[m.status] ?? 'default'}>{m.status}</Badge>
                <Select
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })}
                  className="w-40 py-1.5 text-xs"
                >
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
                <div className="flex gap-1">
                  <button onClick={() => setEditId(m.id)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" title="Manage permissions"><Shield className="h-4 w-4" /></button>
                  {m.role !== 'PRIMARY_ADMIN' && (
                    <button onClick={() => confirm(`Remove ${m.user.name}?`) && remove.mutate(m.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Remove">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add or invite a member">
        <div className="space-y-3">
          <div><label className="label">Name <span className="text-stone-400">(only for new accounts)</span></label><Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><Input placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><Input placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
          </div>
          <div><label className="label">Role</label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </div>
          <div><label className="label">Position <span className="text-stone-400">(optional)</span></label><Input placeholder="e.g. Treasurer" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" loading={add.isPending} onClick={() => add.mutate()}>Add member</Button>
            <Button variant="outline" loading={invite.isPending} onClick={() => invite.mutate()}>Send invite</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editId} onClose={() => setEditId(null)} title={`Manage ${editMember?.user.name ?? ''}`}>
        {editMember && (
          <div className="space-y-3">
            <div>
              <label className="label">Role</label>
              <Select value={editMember.role} onChange={(e) => updateRole.mutate({ id: editMember.id, role: e.target.value })}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </div>
            <div><label className="label">Position</label><Input defaultValue={editMember.position ?? ''} onBlur={(e) => api.patch(`/trusts/${active.trustId}/members/${editMember.id}`, { position: e.target.value }).then(() => { qc.invalidateQueries({ queryKey: ['members', active.trustId] }); toast.success('Updated') })} /></div>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" defaultChecked={editMember.contactVisible} onChange={(e) => api.patch(`/trusts/${active.trustId}/members/${editMember.id}`, { contactVisible: e.target.checked })} className="h-4 w-4 rounded border-stone-300" />
                Show contact publicly
              </label>
            </div>
            <Button variant="danger" className="w-full" onClick={() => { confirm(`Remove ${editMember.user.name}?`) && remove.mutate(editMember.id); setEditId(null) }}>Remove member</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!inviteUrl} onClose={() => setInviteUrl(null)} title="Invitation created">
        <p className="text-sm text-stone-600">Share this link with your member:</p>
        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <p className="break-all font-mono text-sm text-saffron-700">{inviteUrl}</p>
        </div>
        <Button className="mt-4 w-full" onClick={() => { navigator.clipboard.writeText(inviteUrl!); toast.success('Copied!') }}>Copy link</Button>
      </Modal>
    </AppLayout>
  )
}

void Mail