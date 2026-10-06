import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Seo } from '../../lib/seo'
import SiteFooter from '../../components/SiteFooter'

interface LegalPageProps {
  title: string
  path: string
  description: string
  updated?: string
  children: ReactNode
}

export default function LegalPage({ title, path, description, updated, children }: LegalPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <Seo title={`${title} — Pāvati Pustak`} description={description} path={path} />
      <header className="border-b border-stone-200/60 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold text-stone-900">{title}</h1>
        {updated && <p className="mt-2 text-sm text-stone-400">Last updated: {updated}</p>}
        <div className="mt-6 space-y-4 text-stone-600">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
