-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PHONE', 'EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "TrustRole" AS ENUM ('PRIMARY_ADMIN', 'ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'COMMITTEE_MEMBER', 'MEMBER', 'VOLUNTEER', 'COLLECTOR');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'PENDING_APPROVAL', 'REMOVED');

-- CreateEnum
CREATE TYPE "JoinMode" AS ENUM ('OPEN', 'APPROVAL', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'ONLINE', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DonationPrivacy" AS ENUM ('PUBLIC', 'PRIVATE', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "PageSize" AS ENUM ('A4', 'A5', 'A6', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('GENERAL', 'FESTIVAL', 'MEETING', 'CAMPAIGN', 'EVENT', 'NOTICE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "profileImage" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'PHONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trust" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "logoUrl" TEXT,
    "festivalTypes" TEXT[],
    "description" TEXT,
    "registrationNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "pinCode" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "upiId" TEXT,
    "financialYear" TEXT,
    "festivalStartDate" TIMESTAMP(3),
    "festivalEndDate" TIMESTAMP(3),
    "joinMode" "JoinMode" NOT NULL DEFAULT 'OPEN',
    "showCommitteePublicly" BOOLEAN NOT NULL DEFAULT true,
    "showDonorsPublicly" BOOLEAN NOT NULL DEFAULT true,
    "showDonationAmounts" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymousDonations" BOOLEAN NOT NULL DEFAULT true,
    "notificationSms" BOOLEAN NOT NULL DEFAULT true,
    "notificationWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trust_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustMember" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TrustRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" TEXT[],
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" TEXT,
    "contactVisible" BOOLEAN NOT NULL DEFAULT false,
    "introduction" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "donorId" TEXT,
    "donorName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "transactionRef" TEXT,
    "privacy" "DonationPrivacy" NOT NULL DEFAULT 'PRIVATE',
    "donationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectorId" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "campaignId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "verificationToken" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedById" TEXT,
    "voidReason" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptTemplate" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageSize" "PageSize" NOT NULL DEFAULT 'A5',
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "backgroundImageUrl" TEXT,
    "fieldConfigs" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptNumberConfig" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "templateId" TEXT,
    "prefix" TEXT NOT NULL DEFAULT 'RC',
    "separator" TEXT NOT NULL DEFAULT '-',
    "year" TEXT NOT NULL,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "padLength" INTEGER NOT NULL DEFAULT 6,

    CONSTRAINT "ReceiptNumberConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCampaign" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "suggestedAmounts" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MOCK',
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "providerResponse" JSONB,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "donationId" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "trustId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustInvite" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "role" "TrustRole" NOT NULL DEFAULT 'MEMBER',
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TrustInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone", "purpose");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Trust_uniqueCode_key" ON "Trust"("uniqueCode");

-- CreateIndex
CREATE UNIQUE INDEX "Trust_joinCode_key" ON "Trust"("joinCode");

-- CreateIndex
CREATE INDEX "TrustMember_userId_idx" ON "TrustMember"("userId");

-- CreateIndex
CREATE INDEX "TrustMember_trustId_idx" ON "TrustMember"("trustId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustMember_trustId_userId_key" ON "TrustMember"("trustId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_name_phone_key" ON "Donor"("name", "phone");

-- CreateIndex
CREATE INDEX "Donation_trustId_donationDate_idx" ON "Donation"("trustId", "donationDate");

-- CreateIndex
CREATE INDEX "Donation_trustId_paymentMode_idx" ON "Donation"("trustId", "paymentMode");

-- CreateIndex
CREATE INDEX "Donation_trustId_category_idx" ON "Donation"("trustId", "category");

-- CreateIndex
CREATE INDEX "Donation_collectorId_idx" ON "Donation"("collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_verificationToken_key" ON "Receipt"("verificationToken");

-- CreateIndex
CREATE INDEX "Receipt_trustId_generatedAt_idx" ON "Receipt"("trustId", "generatedAt");

-- CreateIndex
CREATE INDEX "Receipt_donationId_idx" ON "Receipt"("donationId");

-- CreateIndex
CREATE INDEX "ReceiptTemplate_trustId_idx" ON "ReceiptTemplate"("trustId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptNumberConfig_trustId_prefix_year_key" ON "ReceiptNumberConfig"("trustId", "prefix", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCampaign_slug_key" ON "PaymentCampaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_orderId_key" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_paymentId_key" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "Announcement_trustId_publishedAt_idx" ON "Announcement"("trustId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_memberId_key" ON "AnnouncementRead"("announcementId", "memberId");

-- CreateIndex
CREATE INDEX "Notification_trustId_createdAt_idx" ON "Notification"("trustId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_trustId_createdAt_idx" ON "AuditLog"("trustId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustInvite_token_key" ON "TrustInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_trustId_userId_key" ON "JoinRequest"("trustId", "userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustMember" ADD CONSTRAINT "TrustMember_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustMember" ADD CONSTRAINT "TrustMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "TrustMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PaymentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReceiptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptTemplate" ADD CONSTRAINT "ReceiptTemplate_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptNumberConfig" ADD CONSTRAINT "ReceiptNumberConfig_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptNumberConfig" ADD CONSTRAINT "ReceiptNumberConfig_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReceiptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCampaign" ADD CONSTRAINT "PaymentCampaign_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TrustMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustInvite" ADD CONSTRAINT "TrustInvite_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;
