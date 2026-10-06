import { Link } from 'react-router-dom'
import LegalPage from './LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      path="/privacy"
      description="How Pāvati Pustak collects, uses, stores, and protects your personal information."
      updated="October 2026"
    >
      <p>
        This Privacy Policy explains how Pāvati Pustak ("we", "us", "our") collects and handles information when
        you use our website and application (the "Service"). By using the Service you agree to the practices
        described here.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Information we collect</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li><strong className="text-stone-900">Account information</strong> — your name, email address, and password (stored only as a salted hash).</li>
        <li><strong className="text-stone-900">Trust and member data</strong> — trust profiles, committee members, and their roles that you or your trust administrators enter.</li>
        <li><strong className="text-stone-900">Donation records</strong> — donor details, amounts, dates, and receipt information entered into the platform.</li>
        <li><strong className="text-stone-900">Uploaded content</strong> — trust logos, receipt template backgrounds, and similar assets you upload.</li>
        <li><strong className="text-stone-900">Usage data</strong> — basic technical information such as browser type and pages visited, used to keep the service reliable.</li>
      </ul>

      <h2 className="pt-4 text-xl font-bold text-stone-900">How we use your information</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>To provide the Service — authenticate you, store donation records, and generate receipts.</li>
        <li>To send transactional messages, such as receipt notifications and password reset links.</li>
        <li>To protect the Service against abuse and improve reliability.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Donation visibility</h2>
      <p>
        Donations can be recorded as public, members-only, or private, based on the choice made when the donation
        is recorded. Public donations may appear on your trust's public profile; private donations are visible
        only to authorised members of the trust.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Data storage and security</h2>
      <p>
        Your data is stored in encrypted transit (HTTPS) and in a protected database. Access to production data
        is restricted to authorised personnel. Uploaded images are stored in encrypted object storage. No system
        is perfectly secure, but we work to protect your information with industry-standard measures.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Sharing</h2>
      <p>
        We do not sell your personal information. We share data only with service providers necessary to operate
        the Service (for example, hosting and email delivery), or where required by law.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Retention</h2>
      <p>
        We keep account and trust data for as long as your account is active. You may request deletion of your
        account and associated data at any time by contacting us.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal information, and opt out of
        non-essential communications. To exercise any of these rights, contact us at{' '}
        <a href="mailto:support@pavatipustak.app" className="font-semibold text-saffron-600 hover:underline">
          support@pavatipustak.app
        </a>.
      </p>

      <h2 className="pt-4 text-xl font-bold text-stone-900">Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be announced through the
        Service. Continued use after changes means you accept the updated policy.
      </p>

      <p>
        Questions about this policy? <Link to="/contact" className="font-semibold text-saffron-600 hover:underline">Contact us</Link>.
      </p>
    </LegalPage>
  )
}
