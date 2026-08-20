import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { api, setTokens } from '../../lib/api'
import { useAuth } from '../../lib/stores/auth'
import { Input, Button, Card } from '../../components/ui'

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().trim().refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type Form = z.infer<typeof schema>

export default function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any; memberships: any[] }>('/auth/register', data)
      setTokens(res.accessToken, res.refreshToken)
      useAuth.getState().setSession({ user: res.user, memberships: res.memberships })
      toast.success('Account created!')
      navigate('/onboarding')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10 p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white">🪔</div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Create your account</h1>
          <p className="mt-1 text-sm text-stone-500">Start managing your trust's Pāvati today</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <Input placeholder="e.g. Rajesh Patil" {...register('name')} autoFocus />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <Input type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Mobile number <span className="text-stone-400">(optional)</span></label>
              <Input placeholder="9876543210" inputMode="numeric" {...register('phone')} />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <Input type="password" placeholder="At least 6 characters" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={loading}>Create account</Button>
          </form>
          <p className="mt-4 text-center text-sm text-stone-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-saffron-600 hover:underline">Log in</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}