import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_FIELDS } from '@pavati/receipt-engine'
import { config } from '../src/config/index.js'
import { generateReceipt } from '../src/services/receipts.js'

const prisma = new PrismaClient()
const here = path.dirname(fileURLToPath(import.meta.url))

const CATEGORIES = ['General Donation', 'Ganpati Donation', 'Aarti Donation', 'Prasad Donation', 'Decoration Fund', 'Event Fund']
const MODES = ['CASH', 'CASH', 'CASH', 'UPI', 'UPI', 'ONLINE', 'BANK_TRANSFER'] as const
const PRIVACY = ['PUBLIC', 'PUBLIC', 'PRIVATE', 'ANONYMOUS'] as const

const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sunil', 'Meera', 'Anil', 'Sneha', 'Vikram', 'Kavita', 'Ramesh', 'Pooja', 'Sanjay', 'Madhuri', 'Nitin', 'Asha', 'Deepak', 'Rekha', 'Mohan', 'Shweta', 'Kiran']
const lastNames = ['Patil', 'Deshmukh', 'Kulkarni', 'More', 'Joshi', 'Shinde', 'Rane', 'Gawade', 'Sawant', 'Kadam', 'Naik', 'Chavan', 'Pawar', 'Jadhav', 'Sathe', 'Vaidya', 'Dixit', 'Karve', 'Gokhale', 'Bhosale']

function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0')
}
void pad

async function main() {
  console.log('Seeding demo data…')

  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.joinRequest.deleteMany()
  await prisma.trustInvite.deleteMany()
  await prisma.receipt.deleteMany()
  await prisma.receiptNumberConfig.deleteMany()
  await prisma.paymentCampaign.deleteMany()
  await prisma.donation.deleteMany()
  await prisma.donor.deleteMany()
  await prisma.receiptTemplate.deleteMany()
  await prisma.trustMember.deleteMany()
  await prisma.trust.deleteMany()
  await prisma.otpCode.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()

  const hash = await bcrypt.hash('pavati123', 10)

  const admin = await prisma.user.create({ data: { name: 'Rajesh Patil', email: 'admin@pavati.in', phone: '9876500001', passwordHash: hash, authProvider: 'EMAIL' } })
  const treasurer = await prisma.user.create({ data: { name: 'Priya Deshmukh', email: 'treasurer@pavati.in', phone: '9876500002', passwordHash: hash, authProvider: 'EMAIL' } })
  const secretary = await prisma.user.create({ data: { name: 'Amit Kulkarni', email: 'secretary@pavati.in', phone: '9876500003', passwordHash: hash, authProvider: 'EMAIL' } })
  const collector = await prisma.user.create({ data: { name: 'Sunil More', email: 'collector@pavati.in', phone: '9876500004', passwordHash: hash, authProvider: 'EMAIL' } })
  const member = await prisma.user.create({ data: { name: 'Meera Joshi', email: 'member@pavati.in', phone: '9876500005', passwordHash: hash, authProvider: 'EMAIL' } })
  const president = await prisma.user.create({ data: { name: 'Vijay Desai', email: 'president@pavati.in', phone: '9876500006', passwordHash: hash, authProvider: 'EMAIL' } })

  const uploadsRoot = path.isAbsolute(config.uploadDir) ? config.uploadDir : path.join(process.cwd(), config.uploadDir)
  const imagesDir = path.join(uploadsRoot, 'images')
  fs.mkdirSync(imagesDir, { recursive: true })
  const bgSource = path.join(here, '..', '..', '..', 'bg_pavati_img.jpg')
  const bgTarget = path.join(imagesDir, 'bg_pavati.jpg')
  if (fs.existsSync(bgSource)) fs.copyFileSync(bgSource, bgTarget)
  const bgUrl = `${config.publicBaseUrl}/uploads/images/bg_pavati.jpg`

  const trust = await prisma.trust.create({
    data: {
      name: 'Shree Ganesh Mitra Mandal',
      uniqueCode: 'GMM2026',
      joinCode: 'GANESH2026ABC',
      festivalTypes: ['Ganesh Chaturthi', 'Navratri'],
      description: 'Trusted community trust organising Ganeshotsav since 1992. We fund education, medical aid and community feasts (Annadanam) for all.',
      registrationNumber: 'MAH/1166/Pune/1992',
      address: 'Ganesh Mandir Road, Kothrud',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      pinCode: '411038',
      contactPhone: '9876500001',
      contactEmail: 'admin@pavati.in',
      website: 'https://ganeshmitramandal.example.in',
      upiId: 'ganeshmitramandal@upi',
      financialYear: '2026-27',
      festivalStartDate: new Date('2026-09-19'),
      festivalEndDate: new Date('2026-09-28'),
      joinMode: 'OPEN',
      notificationSms: true,
      notificationWhatsapp: true,
      notificationEmail: true,
    },
  })

  const roles: Array<[string, string, string]> = [
    [admin.id, 'PRIMARY_ADMIN', 'President & Founder'],
    [president.id, 'PRESIDENT', 'President'],
    [treasurer.id, 'TREASURER', 'Treasurer'],
    [secretary.id, 'SECRETARY', 'Secretary'],
    [collector.id, 'COLLECTOR', 'Collection Coordinator'],
    [member.id, 'MEMBER', 'Committee Member'],
  ]
  const memberRecords = new Map<string, { id: string }>()
  for (const [userId, role, position] of roles) {
    const rec = await prisma.trustMember.create({ data: { trustId: trust.id, userId, role: role as never, position, contactVisible: role !== 'MEMBER' } })
    memberRecords.set(userId, rec)
  }
  const treasurerMemberId = memberRecords.get(treasurer.id)!.id
  const collectorMemberId = memberRecords.get(collector.id)!.id

  const templates = await prisma.receiptTemplate.createMany({
    data: [
      {
        trustId: trust.id,
        name: 'Ganeshotsav 2026',
        pageSize: 'CUSTOM',
        widthMm: 148,
        heightMm: 83,
        backgroundImageUrl: bgUrl,
        fieldConfigs: DEFAULT_FIELDS as unknown as object,
        active: true,
      },
      {
        trustId: trust.id,
        name: 'General Donation Receipt',
        pageSize: 'A5',
        fieldConfigs: DEFAULT_FIELDS.map((f) => ({ ...f })) as unknown as object,
        active: false,
      },
      {
        trustId: trust.id,
        name: 'Navratri 2026',
        pageSize: 'A5',
        fieldConfigs: DEFAULT_FIELDS.map((f) => ({ ...f, color: '#5b2d86' })) as unknown as object,
        active: false,
      },
    ],
  })
  console.log('templates:', templates.count)

  const campaigns = await prisma.paymentCampaign.createMany({
    data: [
      { trustId: trust.id, name: 'Ganpati Donation 2026', slug: 'ganpati-2026', description: 'Support the grand Ganeshotsav celebrations.', category: 'Ganpati Donation', suggestedAmounts: [101, 501, 1001, 2101, 5101] },
      { trustId: trust.id, name: 'Aarti Seva Fund', slug: 'aarti-seva-fund', description: 'Sponsor daily aartis and prasadam during the festival.', category: 'Aarti Donation', suggestedAmounts: [51, 101, 501, 1001] },
      { trustId: trust.id, name: 'Prasad Distribution Fund', slug: 'prasad-fund', description: 'Annadanam & prasad distribution for all devotees.', category: 'Prasad Donation', suggestedAmounts: [201, 501, 1001, 2001] },
    ],
  })
  console.log('campaigns:', campaigns.count)

  const now = new Date()
  const seedDonations: Array<Record<string, unknown>> = []
  let i = 1
  const walkInNames = firstNames.map((f, idx) => `${f} ${lastNames[(idx * 7) % lastNames.length]}`)

  for (const name of walkInNames) {
    const daysAgo = (i * 13) % 40
    const date = new Date(now.getTime() - daysAgo * 86400000)
    const amount = [51, 101, 201, 501, 501, 1001, 1100, 1501, 2100, 5001, 1100, 2101][i % 12]
    seedDonations.push({
      trustId: trust.id,
      donorName: name,
      phone: `98${String(70000000 + i * 137).slice(0, 8)}`,
      address: `${(i % 20) + 1} Shukrawar Peth, Pune`,
      amount,
      category: CATEGORIES[i % CATEGORIES.length],
      paymentMode: MODES[i % MODES.length],
      transactionRef: i % 3 === 0 ? `TXN${100000 + i}` : null,
      privacy: PRIVACY[i % PRIVACY.length],
      donationDate: date,
      collectorId: [treasurerMemberId, collectorMemberId][i % 2],
      status: 'SUCCEEDED',
      isOnline: MODES[i % MODES.length] === 'ONLINE',
      notes: null,
    })
    i++
  }

  await prisma.donation.createMany({ data: seedDonations as never })
  const seeded = await prisma.donation.findMany({ where: { trustId: trust.id } })
  console.log('donations:', seeded.length)

  let receiptsGenerated = 0
  for (const donation of seeded) {
    const trustRow = trust
    try {
      await generateReceipt({
        donationId: donation.id,
        trust: trustRow,
        donation,
        collectorName: donation.collectorId === treasurerMemberId ? 'Priya Deshmukh' : 'Sunil More',
      })
      receiptsGenerated++
    } catch (e) {
      console.warn(`receipt failed for ${donation.donorName}:`, e instanceof Error ? e.message : e)
    }
  }
  console.log('receipts generated:', receiptsGenerated)

  const campaignsForUse = await prisma.paymentCampaign.findMany()
  await prisma.donation.updateMany({
    where: { trustId: trust.id, category: 'Ganpati Donation' },
    data: { campaignId: campaignsForUse[0].id },
  })

  const annAuthors = [admin.id, secretary.id, president.id]
  const announcements = [
    { title: 'Ganeshotsav 2026 starts on 19 September', content: 'Shree Ganesh Mitra Mandal warmly invites all devotees to the ten-day Ganeshotsav celebrations starting 19 September. Daily aarti at 7 PM followed by prasadam. Your donations help us serve everyone. Ganpati Bappa Morya!', type: 'FESTIVAL', pinned: true },
    { title: 'Annual Committee Meeting', content: 'The annual committee meeting will be held on 2 August at 10 AM at the mandal hall. Agenda: budget approval, decoration planning and volunteer allocation. All committee members must attend.', type: 'MEETING', pinned: false },
    { title: 'Annadanam on the last day', content: 'On visarjan day we will serve a grand community feast. We need 30 volunteers for food serving and crowd management. Please sign up at the trust office.', type: 'EVENT', pinned: false },
    { title: 'Donation campaign live', content: 'Our online donation campaign "Ganpati Donation 2026" is now live. Share the link and QR code with family and friends. Every contribution gets an instant digital Pāvati receipt.', type: 'CAMPAIGN', pinned: false },
    { title: 'Decoration committee formed', content: 'The decoration committee for this year is formed under the leadership of Amit Kulkarni. Volunteers are welcome to join the decoration group.', type: 'NOTICE', pinned: false },
  ]
  for (let idx = 0; idx < announcements.length; idx++) {
    const a = announcements[idx]
    await prisma.announcement.create({
      data: {
        trustId: trust.id,
        authorId: annAuthors[idx % annAuthors.length],
        title: a.title,
        content: a.content,
        type: a.type as never,
        pinned: a.pinned,
        publishedAt: new Date(now.getTime() - idx * 86400000 * 2),
      },
    })
  }
  console.log('announcements:', announcements.length)

  await prisma.notification.createMany({
    data: [
      { trustId: trust.id, recipientPhone: '9876500001', channel: 'SMS', message: 'Receipt GMM-2026-000001 generated for ₹501.', status: 'SENT', providerResponse: 'mock-sms-1' },
      { trustId: trust.id, recipientPhone: '9876500001', channel: 'WHATSAPP', message: 'Receipt GMM-2026-000001 generated for ₹501.', status: 'DELIVERED', providerResponse: 'https://wa.me/919876500001' },
      { trustId: trust.id, recipientPhone: '9876500002', channel: 'SMS', message: 'Daily collection summary: ₹2,100 collected today.', status: 'SENT', providerResponse: 'mock-sms-2' },
    ],
  })

  await prisma.auditLog.createMany({
    data: [
      { trustId: trust.id, actorId: admin.id, action: 'TRUST_CREATED', entityType: 'Trust', entityId: trust.id, metadata: { name: trust.name } },
      { trustId: trust.id, actorId: admin.id, action: 'MEMBER_ADDED', entityType: 'TrustMember', entityId: trust.id, metadata: { role: 'TREASURER' } },
      { trustId: trust.id, actorId: treasurer.id, action: 'DONATION_CREATED', entityType: 'Donation', metadata: { amount: 501, mode: 'CASH' } },
      { trustId: trust.id, actorId: secretary.id, action: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', metadata: { title: 'Ganeshotsav 2026' } },
    ],
  })

  console.log('\nSeed complete!')
  console.log('Trust:', trust.name, '| Join code:', trust.joinCode)
  console.log('Demo logins (password: pavati123):')
  console.log('  admin@pavati.in      → Primary Admin (Rajesh Patil)')
  console.log('  treasurer@pavati.in  → Treasurer (Priya Deshmukh)')
  console.log('  secretary@pavati.in  → Secretary (Amit Kulkarni)')
  console.log('  collector@pavati.in  → Collector (Sunil More)')
  console.log('  member@pavati.in     → Member (Meera Joshi)')
  console.log('  president@pavati.in  → President (Vijay Desai)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())