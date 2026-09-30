-- Soft delete for PaymentCampaign.
--
-- The application now archives a campaign (active=false, deletedAt=now) instead of
-- issuing a hard DELETE, because Donation.campaignId is declared `onDelete: SetNull`:
-- removing the campaign row would silently strip the campaign attribution from every
-- historical donation, including receipts already issued for them, with no way back.
ALTER TABLE "PaymentCampaign" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- List queries filter on this, so index it.
CREATE INDEX "PaymentCampaign_deletedAt_idx" ON "PaymentCampaign"("deletedAt");
