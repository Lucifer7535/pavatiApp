-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "submittedById" TEXT;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "TrustMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
