import { z } from 'zod'
import {
  JOIN_MODE,
  PAYMENT_MODE,
  PRIVACY,
  ROLE,
  SUGGESTED_AMOUNTS,
} from './constants.js'
import { ALL_PERMISSIONS, type Permission } from './permissions.js'

function vals<T extends Record<string, string>>(obj: T): [T[keyof T], ...T[keyof T][]] {
  return Object.values(obj) as [T[keyof T], ...T[keyof T][]]
}

const phone = z.string().trim().refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')
const phoneOrEmpty = z.string().trim().refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number')

// Stricter than zod's default: requires a dotted local part or plain handle, no consecutive
// dots, and a real TLD of 2+ letters. Blocks "a@b", "a@b..com", "a@b.c" style junk.
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

export const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'yopmail.fr', 'guerrillamail.com', 'sharklasers.com',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'trashmail.com',
  'getnada.com', 'dispostable.com', 'fakeinbox.com', 'maildrop.cc', 'mailnesia.com',
  'spamgourmet.com', 'burnermail.io', 'moakt.com', 'mohmal.com', 'emailondeck.com',
  'tempr.email', 'tmpmail.org', '1secmail.com', '1secmail.net', 'mailcatch.com',
  'mytemp.email', 'spam4.me', 'grr.la', 'inboxbear.com', 'discard.email',
] as const

export function isDisposableEmail(value: string): boolean {
  const domain = value.trim().toLowerCase().split('@').at(-1)
  if (!domain) return false
  const blocklist = DISPOSABLE_EMAIL_DOMAINS as readonly string[]
  return blocklist.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .regex(EMAIL_REGEX, 'Enter a valid email address')
  .refine((v) => {
    const local = v.split('@')[0] ?? ''
    return !local.startsWith('.') && !local.endsWith('.') && !local.includes('..')
  }, 'Enter a valid email address')
  .refine((v) => !isDisposableEmail(v), 'Temporary/disposable email addresses are not allowed')

export const loginSchema = z.object({
  email: email,
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: email,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: phoneOrEmpty.optional(),
})
export const forgotPasswordSchema = z.object({ email })
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  profile: z
    .object({
      name: z.string().optional(),
      email: z.string().optional().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v), 'Invalid email'),
      picture: z.string().optional(),
    })
    .optional(),
})

export const createTrustSchema = z.object({
  name: z.string().min(2, 'Trust name must be at least 2 characters'),
  logoUrl: z.string().optional().nullable(),
  festivalTypes: z.array(z.string().trim().min(1, 'Festival name is required').max(50)).min(1, 'Select at least one festival').max(20),
  description: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  pinCode: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: email.optional().nullable(),
  website: z.string().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  upiId: z.string().optional().nullable(),
  financialYear: z.string().optional().nullable(),
  festivalStartDate: z.string().optional().nullable(),
  festivalEndDate: z.string().optional().nullable(),
  joinMode: z.enum(vals(JOIN_MODE)).default('OPEN'),
})

export const updateTrustSchema = createTrustSchema.partial()

export const joinByCodeSchema = z.object({ code: z.string().min(3).max(20).optional() })

export const addMemberSchema = z.object({
  userId: z.string().uuid().optional(),
  email: email.optional(),
  phone: phoneOrEmpty.optional(),
  name: z.string().min(2).optional(),
  role: z.enum(vals(ROLE)).default('MEMBER'),
  position: z.string().optional().nullable(),
  introduction: z.string().optional().nullable(),
  contactVisible: z.boolean().optional(),
})

export const updateMemberSchema = z.object({
  role: z.enum(vals(ROLE)).optional(),
  position: z.string().optional().nullable(),
  introduction: z.string().optional().nullable(),
  contactVisible: z.boolean().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).optional(),
})

export const donationCategorySchema = z.string().trim().min(1, 'Category is required').max(50)

export const donationSplitSchema = z.object({
  paymentMode: z.enum(vals(PAYMENT_MODE).filter((m) => m !== 'MIXED') as [string, ...string[]]),
  amount: z.number().positive('Split amount must be greater than 0'),
  transactionRef: z.string().optional().nullable(),
  proofUrl: z.string().optional().nullable(),
})

export const createDonationSchema = z
  .object({
    trustId: z.string().uuid(),
    donorName: z.string().min(2, 'Donor name is required'),
    phone: phoneOrEmpty.optional(),
    email: email.optional().nullable(),
    address: z.string().optional().nullable(),
    amount: z.number().positive('Amount must be greater than 0'),
    category: donationCategorySchema,
    paymentMode: z.enum(vals(PAYMENT_MODE)).optional(),
    transactionRef: z.string().optional().nullable(),
    paymentDate: z.string().optional(),
    privacy: z.enum(vals(PRIVACY)).default('PRIVATE'),
    notes: z.string().optional().nullable(),
    campaignId: z.string().uuid().optional().nullable(),
    splits: z.array(donationSplitSchema).min(1, 'At least one payment split is required').max(5).optional(),
    awaitingPayment: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.splits && data.splits.length > 0) {
      const sum = data.splits.reduce((acc, s) => acc + s.amount, 0)
      if (Math.round(sum) !== Math.round(data.amount)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['splits'], message: 'Split amounts must add up to the donation amount' })
      }
      if (data.awaitingPayment && data.splits.every((s) => s.paymentMode === 'CASH')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['awaitingPayment'], message: 'Cash payments are received immediately' })
      }
    }
  })

export const createCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name is required'),
  description: z.string().optional().nullable(),
  category: donationCategorySchema.optional().nullable(),
  suggestedAmounts: z.array(z.number()).optional(),
  qrCodeUrl: z.string().optional().nullable(),
})

export const selfDonationSchema = z.object({
  amount: z.number().int().positive('Amount must be greater than 0').max(10_000_000),
  category: donationCategorySchema.optional(),
  email: email.optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  transactionRef: z.string().optional().nullable(),
  proofUrl: z.string().url('Invalid proof URL').optional().nullable(),
  privacy: z.enum(vals(PRIVACY)).default('PRIVATE'),
})

export const createAnnouncementSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  content: z.string().min(2, 'Content is required'),
  mediaUrl: z.string().optional().nullable(),
  pinned: z.boolean().default(false),
  type: z.enum(['GENERAL', 'FESTIVAL', 'MEETING', 'CAMPAIGN', 'EVENT', 'NOTICE']).default('GENERAL'),
})

export const updateAnnouncementSchema = createAnnouncementSchema.partial()

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name is required'),
  pageSize: z.enum(['A4', 'A5', 'A6', 'CUSTOM']).default('A5'),
  widthMm: z.number().optional().nullable(),
  heightMm: z.number().optional().nullable(),
  backgroundImageUrl: z.string().optional().nullable(),
  fieldConfigs: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        width: z.number().min(1).max(100),
        height: z.number().min(1).max(100),
        fontSize: z.number().min(0).max(200),
        fontFamily: z.string().default('Mukta'),
        color: z.string().default('#4a1f0c'),
        align: z.enum(['left', 'center', 'right']).default('center'),
        bold: z.boolean().default(false),
        visible: z.boolean().default(true),
        prefix: z.string().optional(),
        showLabel: z.boolean().optional(),
      })
    )
    .default([]),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const updateNotificationSettingsSchema = z.object({
  sms: z.boolean(),
  whatsapp: z.boolean(),
  email: z.boolean(),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: phoneOrEmpty.optional().nullable(),
  email: email.optional().nullable(),
  profileImage: z.string().optional().nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})

export const slugSchema = z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens')

export const amountSchema = z.number().positive().max(10_000_000)

export { phone, phoneOrEmpty, SUGGESTED_AMOUNTS }
export type CreateTrustInput = z.infer<typeof createTrustSchema>
export type UpdateTrustInput = z.infer<typeof updateTrustSchema>
export type CreateDonationInput = z.infer<typeof createDonationSchema>
export type SelfDonationInput = z.infer<typeof selfDonationSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
export type PermissionInput = Permission