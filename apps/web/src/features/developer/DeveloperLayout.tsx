import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, ShieldCheck, Menu } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { clearDevToken } from '../../lib/dev-auth'
import { cn } from '../../lib/utils'
import { Badge } from '../../components/ui'
import AppLogo from '../../components/AppLogo'
import { Seo } from '../../lib/seo'

const navItems = [
  { to: '/dev/dashboard', label: 'Overview', icon: LayoutDashboard },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  const logout = useMutation({
    mutationFn: async () => {
      clearDevToken()
    },
    onSuccess: () => {
      toast.success('Logged out')
      navigate('/dev/login')
    },
  })

  const sidebar = (
    <div className="flex h-full flex-col bg-stone-900 text-stone-200">
      <div className="flex items-center gap-2 px-4 py-4">
        <AppLogo className="h-9 w-9" />
        <div>
          <p className="font-bold leading-tight text-white">Pāvati Pustak</p>
          <p className="text-[10px] text-stone-400">Developer Console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-maroon-700 text-white' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
              )
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-stone-800 p-3">
        <button
          onClick={() => logout.mutate()}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40"
        >
          <LogOut className="h-4.5 w-4.5" /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-50">
      <Seo noindex />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-800 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-stone-900 shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-4 w-4 text-maroon-600" />
            <span className="text-sm font-semibold text-stone-800">Developer Console</span>
          </div>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <Badge color="maroon"><ShieldCheck className="h-3 w-3" /> Developer</Badge>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon-700 text-xs font-bold text-white">D</div>
              <Users className="h-4 w-4 text-stone-400" />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}