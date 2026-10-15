-- AlterEnum
ALTER TYPE "IdentityProvider" ADD VALUE 'FOURTHGEN';

-- AlterEnum
ALTER TYPE "SignInMethod" ADD VALUE 'FOURTHGEN';

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "invitedByLabel" TEXT,
ALTER COLUMN "invitedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "partnerReference" TEXT,
ADD COLUMN     "suspendedByPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "secretSealed" TEXT NOT NULL,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wholesaleDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bodySha256" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" INTEGER NOT NULL,
    "response" JSONB,
    "targetOrganisationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_keyId_key" ON "Partner"("keyId");

-- CreateIndex
CREATE INDEX "PartnerRequest_partnerId_createdAt_idx" ON "PartnerRequest"("partnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerRequest_partnerId_idempotencyKey_key" ON "PartnerRequest"("partnerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_partnerId_partnerReference_key" ON "Organisation"("partnerId", "partnerReference");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRequest" ADD CONSTRAINT "PartnerRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The partner request log is the record of every call: added to, never changed.
CREATE TRIGGER "PartnerRequest_append_only"
  BEFORE UPDATE OR DELETE ON "PartnerRequest"
  FOR EACH ROW EXECUTE FUNCTION tshaeno_forbid_change();

CREATE TRIGGER "PartnerRequest_no_truncate"
  BEFORE TRUNCATE ON "PartnerRequest"
  FOR EACH STATEMENT EXECUTE FUNCTION tshaeno_forbid_change();
