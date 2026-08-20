-- DropIndex
DROP INDEX "Receipt_receiptNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_trustId_receiptNumber_key" ON "Receipt"("trustId", "receiptNumber");
