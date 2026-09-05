import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Upload, UserCircle2, LogOut, KeyRound, Heart, ArrowLeft, ShieldCheck } from 'lucide-react'
import { api, uploadFile, downloadReceiptPdf } from '../../lib/api'
import { useAuth, useActiveTrust } from '../../lib/stores/auth'
import { useLogout } from '../../lib/auth-actions'
import { Button, Card, CardHeader, Input, PageHeader, Badge } from '../../components/ui'
import { AppLayout } from '../../components/layout'
import { fileToDataUrl, formatDate } from '../../lib/utils'
import { ROLE_LABELS } from '@pavati/shared'

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().trim().refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number').optional(),
})
const passSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export default function AccountPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const memberships = useAuth((s) => s.memberships)
  const updateUser = useAuth((s) => s.updateUser)
  const active = useActiveTrust()
  const isGoogle = user?.authProvider === 'GOOGLE'
  const [saving, setSaving] = useState(false)
  const [changing, setChanging] = useState(false)
  const [donations, setDonations] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' } })
  const pass = useForm<z.infer<typeof passSchema>>({ resolver: zodResolver(passSchema) })

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const res = await uploadFile(dataUrl)
    const updated = await api.patch<any>('/users/me', { profileImage: res.url })
    updateUser(updated)
    toast.success('Photo updated')
  }

  const onProfile = async (d: any) => {
    setSaving(true)
    try {
      const updated = await api.patch<any>('/users/me', d)
      updateUser(updated)
      toast.success('Profile updated')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onChangePass = async (d: any) => {
    setChanging(true)
    try {
      await api.post('/users/me/change-password', d)
      toast.success('Password changed')
      pass.reset()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setChanging(false)
    }
  }

  const loadDonations = async () => {
    try {
      const res = await api.get<{ items: any[] }>('/users/me/donations')
      setDonations(res.items ?? [])
      setLoaded(true)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const logout = useLogout()

  const content = (
    <>
      <PageHeader title="My account" subtitle="Profile, memberships and your donations" />

      <Card>
        <CardHeader title="Profile" />
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-saffron-100 text-2xl font-bold text-saffron-700">
                {user?.profileImage ? <img src={user.profileImage} alt="" className="h-full w-full object-cover" /> : <UserCircle2 className="h-8 w-8" />}
              </div>
              <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-saffron-600 p-1.5 text-white shadow">
                <Upload className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            </div>
            <div>
              <p className="font-semibold text-stone-900">{user?.name}</p>
              <Badge color="saffron">{user?.authProvider}</Badge>
            </div>
          </div>
          <form onSubmit={profile.handleSubmit(onProfile)} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><Input {...profile.register('name')} /></div>
            <div><label className="label">Email</label><Input {...profile.register('email')} /></div>
            <div><label className="label">Phone</label><Input {...profile.register('phone')} inputMode="numeric" /></div>
            <div className="flex items-end"><Button type="submit" loading={saving}>Save profile</Button></div>
          </form>
        </div>
      </Card>

      {isGoogle ? (
        <Card className="mt-5">
          <CardHeader title="Sign-in" />
          <div className="flex items-center gap-3 p-6 text-sm text-stone-500">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            You sign in with Google, so there's no password to manage here.
          </div>
        </Card>
      ) : (
        <Card className="mt-5">
          <CardHeader title="Change password" />
          <div className="p-6">
            <form onSubmit={pass.handleSubmit(onChangePass)} className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Current password</label><Input type="password" {...pass.register('currentPassword')} /></div>
              <div><label className="label">New password</label><Input type="password" {...pass.register('newPassword')} /></div>
              <div className="flex items-end"><Button variant="outline" type="submit" loading={changing}><KeyRound className="h-4 w-4" /> Update</Button></div>
            </form>
          </div>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader title="Memberships" subtitle={`You belong to ${memberships.length} trust${memberships.length === 1 ? '' : 's'}`} />
        <div className="divide-y divide-stone-100">
          {memberships.map((m) => (
            <div key={m.trustId} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-saffron-100 text-sm font-bold text-saffron-700">
                {m.trust.logoUrl ? <img src={m.trust.logoUrl} alt="" className="h-full w-full object-cover" /> : m.trust.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-800">{m.trust.name}</p>
                <p className="text-xs text-stone-500">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role} · {formatDate(m.joinedAt)}</p>
              </div>
              <button onClick={() => { useAuth.getState().setActiveTrust(m.trustId); navigate('/app') }} className="text-sm font-semibold text-saffron-600 hover:underline">Open →</button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="My donations" action={<Button variant="outline" size="sm" onClick={loadDonations}>Load</Button>} />
        <div className="p-4">
          {donations.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">{loaded ? 'No donations found for your contact.' : 'Load your donation history to see receipts.'}</p>
          ) : (
            <div className="space-y-2">
              {donations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-stone-100 p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maroon-50 text-maroon-600"><Heart className="h-4 w-4" /></div>
                    <div>
                      <p className="font-medium text-stone-800">{d.trust?.name ?? '—'}</p>
                      <p className="text-xs text-stone-400">{new Date(d.donationDate).toLocaleDateString()} · {d.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-maroon-700">₹{d.amount.toLocaleString('en-IN')}</p>
                    {d.receipts?.[0] && (
                      <button onClick={() => downloadReceiptPdf(d.receipts[0].id)} className="text-xs font-semibold text-saffron-600 hover:underline">Receipt</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Button variant="danger" className="mt-5 w-full" onClick={logout}><LogOut className="h-4 w-4" /> Log out</Button>
    </>
  )

  if (!active) {
    return (
      <div className="min-h-screen bg-cream-50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {content}
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">{content}</div>
    </AppLayout>
  )
}