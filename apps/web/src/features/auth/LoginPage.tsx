import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Smartphone } from 'lucide-react'
import { api, setTokens } from '../../lib/api'
import { useAuth } from '../../lib/stores/auth'
import { Input, Button, Card } from '../../components/ui'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type Form = z.infer<typeof schema>

export default function LoginPage() {
  const user = useAuth((s) => s.user)
  if (user) return <Navigate to="/app" replace />
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any })

  const applySession = async (res: any) => {
    setTokens(res.accessToken, res.refreshToken)
    useAuth.getState().setSession({ user: res.user, memberships: res.memberships })
  }

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', data)
      await applySession(res)
      toast.success('Welcome back!')
      navigate((location.state as any)?.from ?? '/app')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const mockGoogle = async () => {
    setLoading(true)
    try {
      const res = await api.post('/auth/google', {
        idToken: 'mock-google-token',
        profile: { name: 'Demo Google User', email: `google.demo${Date.now()}@mock.google` },
      })
      await applySession(res)
      toast.success('Signed in with Google (mock)')
      navigate('/app')
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
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Welcome back</h1>
          <p className="mt-1 text-sm text-stone-500">Log in to your Pāvati Pustak account</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <Input type="email" placeholder="you@example.com" {...register('email')} autoFocus />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div className="flex items-center justify-between">
              <Link to="/forgot-password" className="text-xs font-medium text-saffron-600 hover:underline">Forgot password?</Link>
              <Link to="/signup" className="text-xs font-medium text-saffron-600 hover:underline">Create account</Link>
            </div>
            <Button type="submit" className="w-full" loading={loading}>Log in</Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-stone-400">
            <span className="h-px flex-1 bg-stone-200" /> or <span className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/otp')}>
              <Smartphone className="h-4 w-4" /> Phone OTP
            </Button>
            <Button type="button" variant="outline" onClick={mockGoogle} disabled={loading}>
              <span className="text-base">G</span> Google
            </Button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-stone-400">
          Demo accounts: admin@pavati.in · treasurer@pavati.in · member@pavati.in (password: pavati123)
        </p>
      </div>
    </div>
  )
}