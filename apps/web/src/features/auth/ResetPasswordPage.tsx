import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { Input, Button, Card } from '../../components/ui'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any })

  const onSubmit = async (data: Form) => {
    if (!token) return toast.error('Missing reset token')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password: data.password })
      toast.success('Password reset. Log in with your new password.')
      navigate('/login')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10 p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white">🔑</div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Set a new password</h1>
          <p className="mt-1 text-sm text-stone-500">Choose a strong password for your account</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <Input type="password" placeholder="At least 6 characters" {...register('password')} autoFocus />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Confirm password</label>
              <Input type="password" placeholder="Repeat password" {...register('confirm')} />
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={loading}>Reset password</Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="font-semibold text-saffron-600 hover:underline">Back to login</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}