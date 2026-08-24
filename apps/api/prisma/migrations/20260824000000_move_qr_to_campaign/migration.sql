-- AlterTable
ALTER TABLE "PaymentCampaign" ADD COLUMN     "qrCodeUrl" TEXT;

-- AlterTable
ALTER TABLE "Trust" DROP COLUMN "qrCodeUrl";
