-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "postClosingAdjustment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Trust" ADD COLUMN     "financialYearEndDate" TIMESTAMP(3),
ADD COLUMN     "financialYearStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FinancialYearClose" (
    "id" TEXT NOT NULL,
    "trustId" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "donationCount" INTEGER NOT NULL,
    "donorCount" INTEGER NOT NULL,
    "byMode" JSONB NOT NULL,
    "byCategory" JSONB NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialYearClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialYearClose_trustId_idx" ON "FinancialYearClose"("trustId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYearClose_trustId_year_key" ON "FinancialYearClose"("trustId", "year");

-- AddForeignKey
ALTER TABLE "FinancialYearClose" ADD CONSTRAINT "FinancialYearClose_trustId_fkey" FOREIGN KEY ("trustId") REFERENCES "Trust"("id") ON DELETE CASCADE ON UPDATE CASCADE;
