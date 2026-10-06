import { Link } from 'react-router-dom'

const links = [
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-stone-500 hover:text-stone-800">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-center text-xs text-stone-400">
          Pāvati Pustak · Digital Trust, Donation &amp; Receipt Management · Made with 🪔 for mandals across Maharashtra
        </p>
      </div>
    </footer>
  )
}
