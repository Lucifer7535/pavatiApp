import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { setDevToken, getDevToken } from '../../lib/dev-auth'
import { Input, Button, Card } from '../../components/ui'
import { Seo } from '../../lib/seo'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type Form = z.infer<typeof schema>

export default function DeveloperLoginPage() {
  if (getDevToken()) return <Navigate to="/dev/dashboard" replace />

  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Login failed')
      setDevToken(body.data.token)
      toast.success('Developer access granted')
      navigate('/dev/dashboard')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-900 via-maroon-950 to-stone-900 p-4">
      <Seo title="Developer Login — Pāvati Pustak" path="/dev/login" noindex />
      <div className="w-full max-w-sm animate-slide-up">
        <Link to="/" className="mb-6 flex items-center gap-2 text-sm text-stone-400 hover:text-stone-200">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-white">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Developer Access</h1>
          <p className="mt-1 text-sm text-stone-400">Platform analytics & administration panel</p>
        </div>
        <Card className="border-stone-800 bg-stone-900/80 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label text-stone-300">Developer Email</label>
              <Input type="email" placeholder="dev@example.com" {...register('email')} autoFocus className="border-stone-700" />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label text-stone-300">Password</label>
              <Input type="password" placeholder="••••••••" {...register('password')} className="border-stone-700" />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full bg-maroon-700 hover:bg-maroon-800" loading={loading}>
              <ShieldCheck className="h-4 w-4" /> Sign in to Console
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-stone-500">
          Restricted area — authorised developers only
        </p>
      </div>
    </div>
  )
}