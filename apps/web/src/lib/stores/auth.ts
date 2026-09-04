import { create } from 'zustand'
import type { TrustRole } from '@pavati/shared'

export interface Membership {
  id: string
  trustId: string
  role: TrustRole
  status: string
  joinedAt: string
  trust: {
    id: string
    name: string
    uniqueCode: string
    logoUrl: string | null
    festivalTypes: string[]
    city: string | null
    upiId: string | null
  }
}

interface AuthState {
  user: {
    id: string
    name: string
    phone: string | null
    email: string | null
    profileImage: string | null
    authProvider: string
  } | null
  memberships: Membership[]
  activeTrustId: string | null
  setSession: (data: { user: AuthState['user']; memberships: Membership[] }) => void
  setActiveTrust: (trustId: string) => void
  updateUser: (user: AuthState['user']) => void
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  memberships: [],
  activeTrustId: typeof localStorage === 'undefined' ? null : localStorage.getItem('pp_active_trust'),
  setSession: (data) =>
    set({
      user: data.user,
      memberships: data.memberships,
      activeTrustId: data.memberships[0]?.trustId ?? null,
    }),
  setActiveTrust: (trustId) => {
    localStorage.setItem('pp_active_trust', trustId)
    set({ activeTrustId: trustId })
  },
  updateUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('pp_active_trust')
    set({ user: null, memberships: [], activeTrustId: null })
  },
}))

export function useActiveTrust() {
  const activeTrustId = useAuth((s) => s.activeTrustId)
  const memberships = useAuth((s) => s.memberships)
  return memberships.find((m) => m.trustId === activeTrustId) ?? memberships[0] ?? null
}