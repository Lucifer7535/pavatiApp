import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, ReceiptText, ShieldCheck, Users, Wallet, Landmark, Smartphone, Bell } from 'lucide-react'
import { Badge } from '../../components/ui'

const features = [
  { icon: Landmark, title: 'One Trust, One Book', desc: 'Replace paper pāvatis with a single digital register that stores every donation, receipt, and member.' },
  { icon: ReceiptText, title: 'Beautiful Pāvati Templates', desc: 'Design festive receipts with your trust logo and background — download as shareable PDFs instantly.' },
  { icon: Smartphone, title: 'Online Donation Links', desc: 'Create payment links and QR codes for festivals. Donors pay, receipts are issued automatically.' },
  { icon: Wallet, title: 'Offline & Online Modes', desc: 'Record cash and UPI donations at the counter, or accept online payments — all in one place.' },
  { icon: ShieldCheck, title: 'Instant Verification', desc: 'Every receipt is verifiable online via a secure token, so donors can confirm its authenticity.' },
  { icon: Bell, title: 'Festive Announcements', desc: 'Broadcast Ganeshotsav or Navratri announcements to members and donors with notifications.' },
]

const steps = [
  { n: '01', title: 'Create your trust', desc: 'Set up the trust profile, address, and Pāvati identity in minutes.' },
  { n: '02', title: 'Design receipts', desc: 'Pick a festive template and arrange fields exactly the way your tradition expects.' },
  { n: '03', title: 'Collect donations', desc: 'Accept offline pāvatis or share online links. Receipts generate automatically.' },
  { n: '04', title: 'Reconcile & report', desc: 'Dashboards and reports keep accounts transparent for the committee.' },
]

import { useAuth } from '../../lib/stores/auth'

export default function LandingPage() {
  const user = useAuth((s) => s.user)
  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/app" replace />
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon-700 text-lg text-white">🪔</div>
            <div>
              <p className="font-bold leading-tight text-stone-900">Pāvati Pustak</p>
              <p className="text-[10px] text-stone-500">Digital Trust & Donation Management</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
            <Link to="/signup" className="btn-primary">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div className="animate-slide-up">
          <Badge color="saffron">🪔 Ganeshotsav 2026 · Navratri · Diwali ready</Badge>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-stone-900 sm:text-5xl">
            The digital <span className="text-saffron-600">Pāvati Pustak</span> for every trust
          </h1>
          <p className="mt-4 max-w-xl text-lg text-stone-600">
            Issue beautiful, verifiable donation receipts to every devotee — instantly. Manage members,
            campaigns, and accounts for your mandal or trust from one festive dashboard.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/signup" className="btn-maroon px-6 py-3 text-base">
              Start your trust <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/donate/ganpati-2026" className="btn-outline px-6 py-3 text-base">
              See a live donate page
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Verifiable receipts</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-saffron-500" /> Works on any phone</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-maroon-600" /> Built for committees</span>
          </div>
        </div>
        <div className="animate-float">
          <div className="mx-auto max-w-sm rounded-3xl border border-stone-200 bg-gradient-to-br from-saffron-50 to-cream-100 p-6 shadow-xl">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>RC-2026-000001</span>
                <span>श्री गणेश मित्र मंडळ</span>
              </div>
              <div className="my-4 text-center">
                <p className="text-[11px] uppercase tracking-widest text-stone-400">Pāvati / पावती</p>
                <p className="mt-2 text-3xl font-extrabold text-saffron-600">₹ 501</p>
                <p className="mt-1 text-sm text-stone-600">Ganpati Donation · Donor: Rajesh Patil</p>
                <p className="mt-1 text-xs text-stone-400">धन्यवाद - Thank you for your support</p>
              </div>
              <div className="h-16 w-full rounded-lg" style={{ backgroundImage: 'url(/uploads/images/bg_pavati.jpg)', backgroundSize: 'cover', opacity: 0.85 }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6 transition-transform hover:-translate-y-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-stone-900">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon-700 text-lg font-bold text-white">{s.n}</div>
                <h3 className="mt-3 font-semibold text-stone-800">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-500">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/signup" className="btn-primary px-8 py-3">Create your free trust</Link>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-stone-400">
        Pāvati Pustak · Digital Trust, Donation &amp; Receipt Management · Made with 🪔 for mandals across Maharashtra
      </footer>
    </div>
  )
}