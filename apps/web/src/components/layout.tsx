import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ReceiptText, Users, Megaphone, Link2, BarChart3, Bell, Settings, FileClock, Wallet, Menu, ChevronDown, LogOut, PlusCircle, UserCircle2 } from 'lucide-react'
import { useAuth, useActiveTrust } from '../lib/stores/auth'
import { clearTokens } from '../lib/api'
import { cn } from '../lib/utils'
import { Badge } from './ui'
import { permissionsForRole } from '@pavati/shared'

const navItems = (permissionCheck: (p: string) => boolean) => [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, always: true },
  { to: '/app/donations', label: 'Donations', icon: Wallet, perm: 'donation:view' },
  { to: '/app/receipts', label: 'Receipts', icon: ReceiptText, perm: 'receipt:view' },
  { to: '/app/templates', label: 'Templates', icon: FileClock, perm: 'template:manage' },
  { to: '/app/members', label: 'Members', icon: Users, perm: 'member:view' },
  { to: '/app/committee', label: 'Committee', icon: Users, perm: 'member:view' },
  { to: '/app/announcements', label: 'Announcements', icon: Megaphone, perm: 'announcement:view' },
  { to: '/app/campaigns', label: 'Payment Links', icon: Link2, perm: 'campaign:view' },
  { to: '/app/reports', label: 'Reports', icon: BarChart3, perm: 'report:view' },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, perm: 'notification:manage' },
  { to: '/app/settings', label: 'Trust Settings', icon: Settings, perm: 'settings:update' },
  { to: '/app/audit', label: 'Audit Log', icon: FileClock, perm: 'audit:view' },
].filter((i) => i.always || (i.perm ? permissionCheck(i.perm) : true))

function TrustSwitcher() {
  const memberships = useAuth((s) => s.memberships)
  const active = useActiveTrust()
  const setActiveTrust = useAuth((s) => s.setActiveTrust)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (memberships.length === 0) return null
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left hover:border-saffron-300"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-saffron-100 text-sm font-bold text-saffron-700">
          {active?.trust.logoUrl ? <img src={active.trust.logoUrl} alt="" className="h-full w-full object-cover" /> : active?.trust.name[0] ?? 'T'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-800">{active?.trust.name}</p>
          <p className="truncate text-[11px] text-stone-500">{active?.trust.city ?? active?.trust.uniqueCode}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-stone-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
            {memberships.map((m) => (
              <button
                key={m.trustId}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-saffron-50"
                onClick={() => {
                  setActiveTrust(m.trustId)
                  setOpen(false)
                  navigate('/app')
                }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100 text-xs font-bold text-stone-600">
                  {m.trust.logoUrl ? <img src={m.trust.logoUrl} alt="" className="h-full w-full object-cover" /> : m.trust.name[0]}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{m.trust.name}</span>
                {m.trustId === active?.trustId && <span className="h-2 w-2 rounded-full bg-saffron-500" />}
              </button>
            ))}
            <div className="border-t border-stone-100 p-2">
              <Link to="/onboarding" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-saffron-600 hover:bg-saffron-50">
                <PlusCircle className="h-4 w-4" /> Create or join trust
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useAuth((s) => s.user)
  const active = useActiveTrust()
  const member = active
  const perms = member ? permissionsForRole(member.role as never) : []
  const navigate = useNavigate()

  const items = navItems((p) => (perms as string[]).includes(p))

  const logout = () => {
    const rt = localStorage.getItem('pp_refresh')
    if (rt) fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) }).catch(() => {})
    clearTokens()
    useAuth.getState().logout()
    navigate('/login')
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon-700 text-lg text-white">🪔</div>
        <div>
          <p className="font-bold leading-tight text-stone-900">Pāvati Pustak</p>
          <p className="text-[10px] text-stone-500">Digital Trust & Receipts</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <TrustSwitcher />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-saffron-100 text-saffron-700' : 'text-stone-600 hover:bg-stone-100'
              )
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-stone-100 p-3">
        <Link to="/account" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
          <UserCircle2 className="h-4.5 w-4.5" />
          <span className="min-w-0">
            <span className="block truncate">{user?.name}</span>
            <span className="block truncate text-[11px] text-stone-400">{user?.email ?? user?.phone}</span>
          </span>
        </Link>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
          <LogOut className="h-4.5 w-4.5" /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-200 bg-white lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 lg:hidden">
            <TrustSwitcher />
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <Badge color="saffron">{active?.role ?? 'Member'}</Badge>

          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}