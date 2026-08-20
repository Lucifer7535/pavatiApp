import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Landmark, Check } from 'lucide-react'
import { JOIN_MODE } from '@pavati/shared'
import { api, uploadFile } from '../../lib/api'
import { useAuth } from '../../lib/stores/auth'
import { Button, Card, Input, Select, Textarea } from '../../components/ui'
import { fileToDataUrl } from '../../lib/utils'
import FestivalPicker from '../../components/FestivalPicker'

const schema = z.object({
  name: z.string().min(2, 'Trust name must be at least 2 characters'),
  festivalTypes: z.array(z.string()).min(1, 'Select at least one festival'),
  description: z.string().optional(),
  registrationNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  address: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  upiId: z.string().optional(),
  joinMode: z.enum(['OPEN', 'APPROVAL', 'INVITE_ONLY']).default('OPEN'),
  financialYear: z.string().optional(),
})
type Form = z.infer<typeof schema>

export default function CreateTrustWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)
  const [created, setCreated] = useState<{ joinCode: string; uniqueCode: string } | null>(null)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { festivalTypes: [], joinMode: 'OPEN' } })

  const festivals = watch('festivalTypes')

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      const res = await uploadFile(dataUrl)
      setLogo(res.url)
      toast.success('Logo uploaded')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post<{ joinCode: string; uniqueCode: string; member: any }>('/trusts', { ...data, logoUrl: logo, country: 'India' })
      setCreated({ joinCode: res.joinCode, uniqueCode: res.uniqueCode })
      const me = await api.get<{ user: any; memberships: any[] }>('/auth/me')
      useAuth.getState().setSession(me)
      useAuth.getState().setActiveTrust(res.member.trustId)
      setStep(2)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/onboarding" className="mb-6 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white"><Landmark className="h-7 w-7" /></div>
          <h1 className="mt-4 text-3xl font-bold text-stone-900">Create your trust</h1>
          <p className="mt-2 text-stone-600">Set up your mandal with a digital Pāvati identity</p>
          <div className="mx-auto mt-6 flex max-w-xs items-center">
            {['Trust details', 'Festivals & join', 'You\'re ready'].map((label, i) => (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i <= step ? 'bg-saffron-600 text-white' : 'bg-stone-200 text-stone-500'}`}>
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="mt-1 hidden text-[10px] text-stone-500 sm:block">{label}</span>
                </div>
                {i < 2 && <div className={`mx-1 h-0.5 flex-1 ${i < step ? 'bg-saffron-600' : 'bg-stone-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {step === 0 && (
          <Card className="p-6">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setStep(1) }}>
              <div>
                <label className="label">Trust / Mandal name *</label>
                <Input placeholder="e.g. Shree Ganesh Mitra Mandal" {...register('name')} autoFocus />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Logo</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-2xl">
                    {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : '🪔'}
                  </div>
                  <label className="cursor-pointer">
                    <span className="btn-outline">Upload logo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <Textarea placeholder="What does your trust do?" {...register('description')} />
              </div>
              <div>
                <label className="label">Registration number</label>
                <Input placeholder="e.g. F-12345 (optional)" {...register('registrationNumber')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">City</label>
                  <Input placeholder="Pune" {...register('city')} />
                </div>
                <div>
                  <label className="label">State</label>
                  <Input placeholder="Maharashtra" {...register('state')} />
                </div>
                <div>
                  <label className="label">PIN code</label>
                  <Input placeholder="411038" {...register('pinCode')} />
                </div>
                <div>
                  <label className="label">Financial year</label>
                  <Input placeholder="2026-2027" {...register('financialYear')} />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <Textarea placeholder="Full address" {...register('address')} />
              </div>
              <Button type="submit" className="w-full">Continue</Button>
            </form>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-6">
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="label">Festivals you celebrate *</label>
                <FestivalPicker
                  value={festivals}
                  onChange={(v) => setValue('festivalTypes', v, { shouldValidate: true })}
                  error={errors.festivalTypes?.message}
                />
              </div>
              <div>
                <label className="label">How can people join?</label>
                <Select {...register('joinMode')}>
                  <option value="OPEN">Open — anyone with the join code joins instantly</option>
                  <option value="APPROVAL">Approval — admins approve each join request</option>
                  <option value="INVITE_ONLY">Invite only — only invited members can join</option>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Contact phone</label>
                  <Input placeholder="9876543210" {...register('contactPhone')} />
                </div>
                <div>
                  <label className="label">Contact email</label>
                  <Input placeholder="trust@example.com" {...register('contactEmail')} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <Input placeholder="https://..." {...register('website')} />
                </div>
                <div>
                  <label className="label">UPI ID</label>
                  <Input placeholder="trust@upi" {...register('upiId')} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button type="submit" className="flex-1" loading={loading}>Create trust</Button>
              </div>
            </form>
          </Card>
        )}

        {step === 2 && created && (
          <Card className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><Check className="h-8 w-8" /></div>
            <h2 className="mt-4 text-2xl font-bold text-stone-900">Trust created! 🪔</h2>
            <p className="mt-2 text-stone-600">Your Pāvati Pustak is ready. Share these codes with your committee.</p>
            <div className="mx-auto mt-6 max-w-sm space-y-3 rounded-2xl bg-stone-50 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Join code</p>
                <p className="font-mono text-2xl font-bold tracking-widest text-saffron-600">{created.joinCode}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Trust code</p>
                <p className="font-mono text-lg font-semibold text-stone-700">{created.uniqueCode}</p>
              </div>
            </div>
            <Button className="mt-6" onClick={() => navigate('/app')}>Go to dashboard →</Button>
          </Card>
        )}
      </div>
    </div>
  )
}

void JOIN_MODE