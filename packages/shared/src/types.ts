import type {
  AuditAction,
  DonationCategory,
  DonationPrivacy,
  DonationStatus,
  JoinMode,
  MemberStatus,
  NotificationChannel,
  NotificationStatus,
  PageSize,
  PaymentMode,
  ReceiptStatus,
  TrustRole,
} from './constants.js'
import type { Permission } from './permissions.js'

export interface User {
  id: string
  name: string
  phone: string | null
  email: string | null
  profileImage: string | null
  authProvider: 'PHONE' | 'EMAIL' | 'GOOGLE'
  createdAt: string
}

export interface Trust {
  id: string
  name: string
  uniqueCode: string
  joinCode: string
  logoUrl: string | null
  festivalTypes: string[]
  description: string | null
  registrationNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  pinCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  website: string | null
  upiId: string | null
  financialYear: string | null
  festivalStartDate: string | null
  festivalEndDate: string | null
  joinMode: JoinMode
  showCommitteePublicly: boolean
  showDonorsPublicly: boolean
  showDonationAmounts: boolean
  allowAnonymousDonations: boolean
  notificationSms: boolean
  notificationWhatsapp: boolean
  notificationEmail: boolean
  createdAt: string
}

export interface TrustMember {
  id: string
  trustId: string
  userId: string
  role: TrustRole
  permissions: Permission[] | null
  status: MemberStatus
  joinedAt: string
  user?: User
  position?: string
  contactVisible?: boolean
  introduction?: string
}

export interface Donor {
  id: string
  name: string
  phone: string
  address: string | null
  createdAt: string
}

export interface Donation {
  id: string
  trustId: string
  donorId: string | null
  donorName: string
  phone: string
  amount: number
  category: DonationCategory | string
  paymentMode: PaymentMode
  transactionRef: string | null
  privacy: DonationPrivacy
  donationDate: string
  collectorId: string | null
  status: DonationStatus
  notes: string | null
  isOnline: boolean
  campaignId: string | null
  createdAt: string
  donor?: Donor
  collector?: TrustMember
  receipts?: Receipt[]
}

export interface Receipt {
  id: string
  receiptNumber: string
  donationId: string
  trustId: string
  templateId: string
  pdfUrl: string | null
  verificationToken: string
  status: ReceiptStatus
  generatedAt: string
}

export interface ReceiptFieldConfig {
  key: string
  label: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  visible: boolean
  prefix?: string
  showLabel?: boolean
}

export interface ReceiptTemplate {
  id: string
  trustId: string
  name: string
  pageSize: PageSize
  backgroundImageUrl: string | null
  widthMm: number | null
  heightMm: number | null
  fieldConfigs: ReceiptFieldConfig[]
  active: boolean
  createdAt: string
}

export interface PaymentCampaign {
  id: string
  trustId: string
  name: string
  description: string | null
  slug: string
  category: string | null
  active: boolean
  createdAt: string
}

export interface Announcement {
  id: string
  trustId: string
  authorId: string
  title: string
  content: string
  mediaUrl: string | null
  pinned: boolean
  publishedAt: string
  author?: User
}

export interface NotificationLog {
  id: string
  trustId: string
  donationId: string | null
  recipientPhone: string | null
  recipientEmail: string | null
  channel: NotificationChannel
  message: string
  status: NotificationStatus
  providerResponse: string | null
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  trustId: string | null
  actorId: string | null
  action: AuditAction
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface TrustMemberWithUser extends TrustMember {
  user: User
}

export interface TrustWithStats extends Trust {
  memberCount: number
  donationCount: number
  totalCollected: number
  todayCollected: number
}

export interface AuthSession {
  accessToken: string
  user: User
  memberships: TrustMemberWithUser[]
}