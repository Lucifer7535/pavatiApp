-- Credential-version axis so a password change invalidates already-issued access tokens.
-- Without this, access tokens are stateless and stay valid for their full 7d lifetime.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
