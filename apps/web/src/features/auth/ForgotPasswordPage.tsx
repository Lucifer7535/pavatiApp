import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../lib/api'
import { Input, Button, Card } from '../../components/ui'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type Form = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) as any })

  const onSubmit = async (data: Form) => {
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', data)
      toast.success('If an account exists, a reset link was sent.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10 p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <Link to="/login" className="mb-6 flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white">🔑</div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Forgot password</h1>
          <p className="mt-1 text-sm text-stone-500">We'll email you a secure reset link</p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <Input type="email" placeholder="you@example.com" {...register('email')} autoFocus />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={loading}>Send reset link</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}