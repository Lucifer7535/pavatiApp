import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, setTokens } from '../../lib/api'
import { useAuth } from '../../lib/stores/auth'
import { Input, Button, Card } from '../../components/ui'

export default function OtpPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(30)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!sent || countdown <= 0) return
    const t = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [sent, countdown])

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error('Enter a valid 10-digit mobile number')
    setLoading(true)
    try {
      const res = await api.post<{ devOtp?: string }>('/auth/phone/request-otp', { phone })
      setDevOtp(res.devOtp ?? null)
      setSent(true)
      setCountdown(30)
      toast.success('OTP sent', { description: res.devOtp ? `Mock OTP: ${res.devOtp}` : 'Check your phone' })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const setDigit = (i: number, v: string) => {
    const next = [...digits]
    next[i] = v.replace(/\D/g, '').slice(-1)
    setDigits(next)
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }
  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const verify = async () => {
    const otp = digits.join('')
    if (otp.length < 6) return toast.error('Enter the 6-digit code')
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; user: any; memberships: any[] }>('/auth/phone/verify', { phone, otp })
      setTokens(res.accessToken, res.refreshToken)
      useAuth.getState().setSession({ user: res.user, memberships: res.memberships })
      toast.success('Verified!')
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
        <Link to="/login" className="mb-6 block text-sm text-stone-500 hover:text-stone-700">← Back to login</Link>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon-700 text-2xl text-white">📱</div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Log in with phone</h1>
          <p className="mt-1 text-sm text-stone-500">Verify your mobile number to sign in</p>
        </div>
        <Card className="p-6">
          {!sent ? (
            <div className="space-y-4">
              <div>
                <label className="label">Mobile number</label>
                <Input placeholder="9876543210" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} autoFocus />
              </div>
              <Button className="w-full" onClick={sendOtp} loading={loading}>Send OTP</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-stone-500">Enter the 6-digit code sent to <b>{phone}</b></p>
              <div className="flex justify-between gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputs.current[i] = el }}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                    inputMode="numeric"
                    maxLength={1}
                    className="h-12 w-full rounded-xl border border-stone-300 text-center text-xl font-bold focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-100"
                  />
                ))}
              </div>
              {devOtp && <p className="text-center text-xs font-semibold text-emerald-600">Mock OTP: {devOtp}</p>}
              <Button className="w-full" onClick={verify} loading={loading}>Verify & continue</Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-stone-400">Resend in {countdown}s</p>
                ) : (
                  <button onClick={sendOtp} className="text-xs font-semibold text-saffron-600 hover:underline">Resend OTP</button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}