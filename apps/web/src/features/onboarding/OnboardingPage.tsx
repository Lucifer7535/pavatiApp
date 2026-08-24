import { Link, useNavigate } from 'react-router-dom'
import { Landmark, Search, PlusCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../lib/stores/auth'
import LogoutButton from '../../components/LogoutButton'
import AppLogo from '../../components/AppLogo'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const memberships = useAuth((s) => s.memberships)
  const setActiveTrust = useAuth((s) => s.setActiveTrust)

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-saffron-50 to-maroon-700/10">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6 flex items-center gap-2">
          <Link to="/app" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <LogoutButton />
        </div>
        <div className="text-center">
          <AppLogo className="mx-auto h-14 w-14 rounded-2xl" />
          <h1 className="mt-4 text-3xl font-bold text-stone-900">Welcome to Pāvati Pustak</h1>
          <p className="mt-2 text-stone-600">Create a new trust or join an existing one to start managing pāvatis.</p>
        </div>

        {memberships.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Your trusts</h2>
            <div className="grid gap-3">
              {memberships.map((m) => (
                <button
                  key={m.trustId}
                  onClick={() => {
                    setActiveTrust(m.trustId)
                    navigate('/app')
                  }}
                  className="card flex items-center gap-4 p-4 text-left transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-saffron-100 text-lg font-bold text-saffron-700">
                    {m.trust.logoUrl ? <img src={m.trust.logoUrl} alt="" className="h-full w-full object-cover" /> : m.trust.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{m.trust.name}</p>
                    <p className="text-xs text-stone-500">{m.trust.city ?? m.trust.uniqueCode} · {m.role}</p>
                  </div>
                  <span className="text-sm font-medium text-saffron-600">Open →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link to="/create-trust" className="card group p-6 text-center transition-transform hover:-translate-y-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon-100 text-maroon-600 group-hover:bg-maroon-700 group-hover:text-white transition-colors">
              <Landmark className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-stone-900">Create a new trust</h3>
            <p className="mt-1 text-sm text-stone-500">Set up your mandal or trust with templates, code and committee.</p>
            <PlusCircle className="mx-auto mt-3 h-5 w-5 text-saffron-500" />
          </Link>
          <Link to="/search" className="card group p-6 text-center transition-transform hover:-translate-y-1">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron-100 text-saffron-600 group-hover:bg-saffron-500 group-hover:text-white transition-colors">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-stone-900">Find & join a trust</h3>
            <p className="mt-1 text-sm text-stone-500">Search by name or enter a join code to become a member.</p>
            <Search className="mx-auto mt-3 h-5 w-5 text-saffron-500" />
          </Link>
        </div>
      </div>
    </div>
  )
}