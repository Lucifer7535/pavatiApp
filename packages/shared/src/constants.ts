export const ROLE = {
  PRIMARY_ADMIN: 'PRIMARY_ADMIN',
  ADMIN: 'ADMIN',
  PRESIDENT: 'PRESIDENT',
  VICE_PRESIDENT: 'VICE_PRESIDENT',
  SECRETARY: 'SECRETARY',
  JOINT_SECRETARY: 'JOINT_SECRETARY',
  TREASURER: 'TREASURER',
  COMMITTEE_MEMBER: 'COMMITTEE_MEMBER',
  MEMBER: 'MEMBER',
  VOLUNTEER: 'VOLUNTEER',
  COLLECTOR: 'COLLECTOR',
} as const

export type TrustRole = (typeof ROLE)[keyof typeof ROLE]

export const ROLE_LABELS: Record<TrustRole, string> = {
  PRIMARY_ADMIN: 'Primary Admin',
  ADMIN: 'Admin',
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  SECRETARY: 'Secretary',
  JOINT_SECRETARY: 'Joint Secretary',
  TREASURER: 'Treasurer',
  COMMITTEE_MEMBER: 'Committee Member',
  MEMBER: 'Member',
  VOLUNTEER: 'Volunteer',
  COLLECTOR: 'Collector',
}

export const ROLE_ORDER: TrustRole[] = [
  ROLE.PRIMARY_ADMIN,
  ROLE.ADMIN,
  ROLE.PRESIDENT,
  ROLE.VICE_PRESIDENT,
  ROLE.SECRETARY,
  ROLE.JOINT_SECRETARY,
  ROLE.TREASURER,
  ROLE.COMMITTEE_MEMBER,
  ROLE.MEMBER,
  ROLE.VOLUNTEER,
  ROLE.COLLECTOR,
]

export const FESTIVALS = [
  'Ganesh Chaturthi',
  'Navratri',
  'Durga Puja',
  'Dahi Handi',
  'Janmashtami',
  'Holi',
  'Diwali',
  'Shiv Jayanti',
  'Hanuman Jayanti',
  'Charitable Trust',
  'Community Event',
  'Other',
] as const

export const PAYMENT_MODE = {
  CASH: 'CASH',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CARD: 'CARD',
  OTHER: 'OTHER',
  MIXED: 'MIXED',
} as const
export type PaymentMode = (typeof PAYMENT_MODE)[keyof typeof PAYMENT_MODE]

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CARD: 'Card',
  OTHER: 'Other',
  MIXED: 'Mixed',
}

export const DONATION_CATEGORIES = [
  'General Donation',
  'Ganpati Donation',
  'Aarti Donation',
  'Prasad Donation',
  'Decoration Fund',
  'Event Fund',
  'Navratri Garba Fund',
  'Social Activity Fund',
  'Annadanam',
  'Other',
] as const
export type DonationCategory = (typeof DONATION_CATEGORIES)[number]

export const DONATION_STATUS = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
} as const
export type DonationStatus = (typeof DONATION_STATUS)[keyof typeof DONATION_STATUS]

export const PRIVACY = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  ANONYMOUS: 'ANONYMOUS',
} as const
export type DonationPrivacy = (typeof PRIVACY)[keyof typeof PRIVACY]

export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  REMOVED: 'REMOVED',
} as const
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS]

export const JOIN_MODE = {
  OPEN: 'OPEN',
  APPROVAL: 'APPROVAL',
  INVITE_ONLY: 'INVITE_ONLY',
} as const
export type JoinMode = (typeof JOIN_MODE)[keyof typeof JOIN_MODE]

export const RECEIPT_STATUS = {
  ACTIVE: 'ACTIVE',
  VOID: 'VOID',
} as const
export type ReceiptStatus = (typeof RECEIPT_STATUS)[keyof typeof RECEIPT_STATUS]

export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS]

export const NOTIFICATION_CHANNEL = {
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
} as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]

export const AUDIT_ACTION = {
  TRUST_CREATED: 'TRUST_CREATED',
  TRUST_UPDATED: 'TRUST_UPDATED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  DONATION_CREATED: 'DONATION_CREATED',
  DONATION_VOIDED: 'DONATION_VOIDED',
  RECEIPT_CREATED: 'RECEIPT_CREATED',
  RECEIPT_VOIDED: 'RECEIPT_VOIDED',
  TEMPLATE_CREATED: 'TEMPLATE_CREATED',
  TEMPLATE_UPDATED: 'TEMPLATE_UPDATED',
  TEMPLATE_ACTIVATED: 'TEMPLATE_ACTIVATED',
  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED: 'CAMPAIGN_UPDATED',
  CAMPAIGN_TOGGLED: 'CAMPAIGN_TOGGLED',
  ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
  ANNOUNCEMENT_UPDATED: 'ANNOUNCEMENT_UPDATED',
  ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
} as const
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION]

export const PAGE_SIZES = {
  A4: 'A4',
  A5: 'A5',
  A6: 'A6',
  CUSTOM: 'CUSTOM',
} as const
export type PageSize = (typeof PAGE_SIZES)[keyof typeof PAGE_SIZES]

export const PAGE_SIZE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  CUSTOM: { width: 130, height: 80 },
}

export const SUGGESTED_AMOUNTS = [51, 101, 501, 1001, 2101, 5101]