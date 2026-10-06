import { Link } from 'react-router-dom'
import { ReceiptText, ShieldCheck, Smartphone, Landmark } from 'lucide-react'
import LegalPage from './LegalPage'

const highlights = [
  { icon: Landmark, title: 'One trust, one digital book', desc: 'Replace paper pāvatis with a single register for donations, receipts, and members.' },
  { icon: ReceiptText, title: 'Festive receipt templates', desc: 'Design receipts with your trust logo and background, ready to download as shareable PDFs.' },
  { icon: Smartphone, title: 'Offline and online donations', desc: 'Record cash and UPI at the counter or share online donation links — all in one place.' },
  { icon: ShieldCheck, title: 'Verifiable receipts', desc: 'Every receipt carries a secure token so donors can confirm its authenticity online.' },
]

export default function AboutPage() {
  return (
    <LegalPage
      title="About Us"
      path="/about"
      description="Pāvati Pustak is a digital trust, donation and receipt management platform built for mandals and trusts across Maharashtra."
    >
      <p className="text-lg text-stone-700">
        Pāvati Pustak is a digital platform that helps trusts, mandals, and temple committees manage donations,
        issue beautiful receipts, and keep their accounts transparent — all from one festive dashboard.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Our mission</h2>
      <p>
        For generations, the pāvati (पावती) — a handwritten donation receipt — has been the backbone of trust
        accounting during Ganeshotsav, Navratri, and beyond. We built Pāvati Pustak to preserve that tradition
        while replacing the physical register: paperless records, instantly verifiable receipts, and dashboards
        every committee member can trust.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">What we offer</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {highlights.map((h) => (
          <div key={h.title} className="card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
              <h.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-semibold text-stone-900">{h.title}</h3>
            <p className="mt-1 text-sm text-stone-500">{h.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Who it's for</h2>
      <p>
        Ganeshotsav mandals, temple trusts, charity committees, and any organisation that collects donations and
        wants to give donors a professional, verifiable receipt — without the overhead of spreadsheets or
        accounting software.
      </p>

      <p>
        Have questions or feedback?{' '}
        <Link to="/contact" className="font-semibold text-saffron-600 hover:underline">Contact us</Link> — we'd love
        to hear from you.
      </p>
    </LegalPage>
  )
}
