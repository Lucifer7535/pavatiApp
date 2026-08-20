import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth, useActiveTrust } from '../lib/stores/auth'
import { permissionsForRole, type Permission, type TrustRole } from '@pavati/shared'
import { Toaster } from 'sonner'
import { Spinner } from '../components/ui'

const LandingPage = lazy(() => import('../features/landing/LandingPage'))
const LoginPage = lazy(() => import('../features/auth/LoginPage'))
const SignupPage = lazy(() => import('../features/auth/SignupPage'))
const OtpPage = lazy(() => import('../features/auth/OtpPage'))
const ForgotPasswordPage = lazy(() => import('../features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../features/auth/ResetPasswordPage'))
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage'))
const CreateTrustWizard = lazy(() => import('../features/onboarding/CreateTrustWizard'))
const JoinTrustPage = lazy(() => import('../features/onboarding/JoinTrustPage'))
const TrustSearchPage = lazy(() => import('../features/onboarding/TrustSearchPage'))
const TrustPublicProfile = lazy(() => import('../features/trust/TrustPublicProfile'))
const DonatePage = lazy(() => import('../features/donate/DonatePage'))
const PaymentSuccessPage = lazy(() => import('../features/donate/PaymentSuccessPage'))
const ReceiptVerifyPage = lazy(() => import('../features/receipts/ReceiptVerifyPage'))
const AccountPage = lazy(() => import('../features/account/AccountPage'))
const TrustDashboard = lazy(() => import('../features/dashboard/TrustDashboard'))
const DonationsPage = lazy(() => import('../features/donations/DonationsPage'))
const CreateDonationPage = lazy(() => import('../features/donations/CreateDonationPage'))
const DonationDetailPage = lazy(() => import('../features/donations/DonationDetailPage'))
const ReceiptsPage = lazy(() => import('../features/receipts/ReceiptsPage'))
const ReceiptPreviewPage = lazy(() => import('../features/receipts/ReceiptPreviewPage'))
const TemplatesPage = lazy(() => import('../features/templates/TemplatesPage'))
const TemplateEditorPage = lazy(() => import('../features/templates/TemplateEditorPage'))
const MembersPage = lazy(() => import('../features/members/MembersPage'))
const CommitteePage = lazy(() => import('../features/members/CommitteePage'))
const AnnouncementsPage = lazy(() => import('../features/announcements/AnnouncementsPage'))
const CreateAnnouncementPage = lazy(() => import('../features/announcements/CreateAnnouncementPage'))
const CampaignsPage = lazy(() => import('../features/campaigns/CampaignsPage'))
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'))
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'))
const TrustSettingsPage = lazy(() => import('../features/settings/TrustSettingsPage'))
const AuditLogPage = lazy(() => import('../features/audit/AuditLogPage'))

function AppShell() {
  return (
    <>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner /></div>}>
        <Outlet />
      </Suspense>
      <Toaster position="top-right" richColors />
    </>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function RequireMembership({ children }: { children: ReactNode }) {
  const memberships = useAuth((s) => s.memberships)
  const loaded = useAuth((s) => s.user !== null)
  if (loaded && memberships.length === 0) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const member = useActiveTrust()
  if (!member) return <Navigate to="/onboarding" replace />
  const perms = permissionsForRole(member.role as TrustRole)
  if (!perms.includes(permission)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl">🔒</p>
          <h2 className="mt-3 text-lg font-semibold text-stone-800">Permission required</h2>
          <p className="mt-1 text-sm text-stone-500">
            Your role ({member.role}) does not allow access to this section.
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function DashboardLoader() {
  const active = useActiveTrust()
  if (!active) return <Spinner />
  return <TrustDashboard trustId={active.trustId} />
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/otp', element: <OtpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/donate/:slug', element: <DonatePage /> },
      { path: '/donate', element: <DonatePage /> },
      { path: '/payment-success', element: <PaymentSuccessPage /> },
      { path: '/trust/:trustId', element: <TrustPublicProfile /> },
      { path: '/receipt/verify/:token', element: <ReceiptVerifyPage /> },

      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/create-trust', element: <CreateTrustWizard /> },
          { path: '/join', element: <JoinTrustPage /> },
          { path: '/search', element: <TrustSearchPage /> },
          { path: '/account', element: <AccountPage /> },

          {
            element: (
              <RequireMembership>
                <Outlet />
              </RequireMembership>
            ),
            children: [
              { path: '/app', element: <DashboardLoader /> },
              { path: '/app/dashboard', element: <DashboardLoader /> },
              { path: '/app/donations', element: <RequirePermission permission="donation:view"><DonationsPage /></RequirePermission> },
              { path: '/app/donations/new', element: <RequirePermission permission="donation:create"><CreateDonationPage /></RequirePermission> },
              { path: '/app/donations/:donationId', element: <RequirePermission permission="donation:view"><DonationDetailPage /></RequirePermission> },
              { path: '/app/receipts', element: <RequirePermission permission="receipt:view"><ReceiptsPage /></RequirePermission> },
              { path: '/app/receipts/:receiptId', element: <RequirePermission permission="receipt:view"><ReceiptPreviewPage /></RequirePermission> },
              { path: '/app/templates', element: <RequirePermission permission="template:manage"><TemplatesPage /></RequirePermission> },
              { path: '/app/templates/new', element: <RequirePermission permission="template:manage"><TemplateEditorPage /></RequirePermission> },
              { path: '/app/templates/:templateId/edit', element: <RequirePermission permission="template:manage"><TemplateEditorPage /></RequirePermission> },
              { path: '/app/members', element: <RequirePermission permission="member:view"><MembersPage /></RequirePermission> },
              { path: '/app/committee', element: <RequirePermission permission="member:view"><CommitteePage /></RequirePermission> },
              { path: '/app/announcements', element: <RequirePermission permission="announcement:view"><AnnouncementsPage /></RequirePermission> },
              { path: '/app/announcements/new', element: <RequirePermission permission="announcement:create"><CreateAnnouncementPage /></RequirePermission> },
              { path: '/app/campaigns', element: <RequirePermission permission="campaign:view"><CampaignsPage /></RequirePermission> },
              { path: '/app/reports', element: <RequirePermission permission="report:view"><ReportsPage /></RequirePermission> },
              { path: '/app/notifications', element: <RequirePermission permission="notification:manage"><NotificationsPage /></RequirePermission> },
              { path: '/app/settings', element: <RequirePermission permission="settings:update"><TrustSettingsPage /></RequirePermission> },
              { path: '/app/audit', element: <RequirePermission permission="audit:view"><AuditLogPage /></RequirePermission> },
            ],
          },
        ],
      },
    ],
  },
])