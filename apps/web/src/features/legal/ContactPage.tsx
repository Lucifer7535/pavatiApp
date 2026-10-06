import { toast } from 'sonner'
import { Copy, Mail, Clock, MessageSquare } from 'lucide-react'
import LegalPage from './LegalPage'

const SUPPORT_EMAIL = 'support@pavatipustak.app'

const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText(SUPPORT_EMAIL)
    toast.success('Email copied — paste it in your mail app')
  } catch {
    toast(SUPPORT_EMAIL)
  }
}

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact Us"
      path="/contact"
      description="Get in touch with the Pāvati Pustak team — questions, feedback, or support."
    >
      <p className="text-lg text-stone-700">
        Questions, feedback, or need help with your trust? We're happy to help.
      </p>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-stone-900">Email us</h2>
            <p className="mt-1 text-sm text-stone-500">
              Write to us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-saffron-600 hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              and we'll get back to you.
            </p>
            <button type="button" onClick={copyEmail} className="btn-primary mt-4 px-5 py-2.5">
              <Copy className="h-4 w-4" /> Copy email address
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-semibold text-stone-900">Response time</h3>
          <p className="mt-1 text-sm text-stone-500">
            We usually reply within 1–2 business days. During festival season it may take a little longer.
          </p>
        </div>
        <div className="card p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="mt-3 font-semibold text-stone-900">What to include</h3>
          <p className="mt-1 text-sm text-stone-500">
            Tell us your trust name and a short description of the issue — it helps us resolve things faster.
          </p>
        </div>
      </div>
    </LegalPage>
  )
}
