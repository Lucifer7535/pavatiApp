-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'MIXED';

-- CreateTable
CREATE TABLE "DonationSplit" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionRef" TEXT,
    "proofUrl" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonationSplit_donationId_idx" ON "DonationSplit"("donationId");

-- AddForeignKey
ALTER TABLE "DonationSplit" ADD CONSTRAINT "DonationSplit_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationSplit" ADD CONSTRAINT "DonationSplit_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "TrustMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one verified split per existing donation
INSERT INTO "DonationSplit" ("id", "donationId", "paymentMode", "amount", "transactionRef", "verifiedAt")
SELECT gen_random_uuid(), d."id", d."paymentMode", d."amount", d."transactionRef", NOW()
FROM "Donation" d;
