-- Bind a donation to the authenticated principal who made it. Contact strings (phone,
-- email) are mutable and self-assertable via PATCH /me, so they cannot be the
-- authorization key for a user-scoped donation read.
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Donation" ADD COLUMN "donorUserId" TEXT;

CREATE INDEX "Donation_donorUserId_idx" ON "Donation"("donorUserId");

ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorUserId_fkey"
  FOREIGN KEY ("donorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
