import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding production admin user…')

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
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('Pavati@7535', 10)
  await prisma.user.create({
    data: {
      name: 'Pranay Pawar',
      email: 'pranaypawar7535@gmail.com',
      passwordHash,
      authProvider: 'EMAIL',
    },
  })

  console.log('Seed complete.')
  console.log('Admin login: pranaypawar7535@gmail.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
