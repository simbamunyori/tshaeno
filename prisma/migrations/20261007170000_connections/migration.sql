-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ANY', 'INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeliveryTarget" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('PENDING', 'APPLIED', 'FAILED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssignmentScope" ADD VALUE 'LOCATION';
ALTER TYPE "AssignmentScope" ADD VALUE 'GROUP';

-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN     "sourceAttribute" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "syncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SignatureAssignment" ADD COLUMN     "audience" "Audience" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "DirectoryConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "adminEmail" TEXT,
    "tenantId" TEXT,
    "consentState" TEXT,
    "consentFlow" JSONB,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "health" JSONB NOT NULL DEFAULT '[]',
    "checkedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncResult" JSONB,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureDelivery" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "target" "DeliveryTarget" NOT NULL,
    "state" "DeliveryState" NOT NULL DEFAULT 'PENDING',
    "templateId" TEXT,
    "hash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutlookAddin" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutlookAddin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryConnection_consentState_key" ON "DirectoryConnection"("consentState");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryConnection_organisationId_provider_key" ON "DirectoryConnection"("organisationId", "provider");

-- CreateIndex
CREATE INDEX "SignatureDelivery_organisationId_target_state_idx" ON "SignatureDelivery"("organisationId", "target", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureDelivery_personId_target_key" ON "SignatureDelivery"("personId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "OutlookAddin_organisationId_key" ON "OutlookAddin"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OutlookAddin_key_key" ON "OutlookAddin"("key");

-- CreateIndex
CREATE INDEX "Person_organisationId_source_externalId_idx" ON "Person"("organisationId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "DirectoryConnection" ADD CONSTRAINT "DirectoryConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureDelivery" ADD CONSTRAINT "SignatureDelivery_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureDelivery" ADD CONSTRAINT "SignatureDelivery_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutlookAddin" ADD CONSTRAINT "OutlookAddin_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Row-level security ─────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['DirectoryConnection','SignatureDelivery','OutlookAddin'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("organisationId" = tshaeno_org() OR tshaeno_system()) WITH CHECK ("organisationId" = tshaeno_org() OR tshaeno_system())', t);
  END LOOP;
END
$$;
