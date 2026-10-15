-- CreateEnum
CREATE TYPE "PlanPackage" AS ENUM ('SIGNATURES', 'FULL');

-- CreateEnum
CREATE TYPE "AwayStatus" AS ENUM ('SAVED', 'SET', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "package" "PlanPackage" NOT NULL DEFAULT 'FULL';

-- CreateTable
CREATE TABLE "MeetingBackground" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'panel',
    "colour" TEXT NOT NULL DEFAULT '#14213D',
    "brandKitId" TEXT,
    "imageAssetId" TEXT,
    "showName" BOOLEAN NOT NULL DEFAULT true,
    "showTitle" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingBackground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwayMessage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "withSignature" BOOLEAN NOT NULL DEFAULT true,
    "status" "AwayStatus" NOT NULL DEFAULT 'SAVED',
    "mailbox" TEXT,
    "lastError" TEXT,
    "setBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwayMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingBackground_organisationId_idx" ON "MeetingBackground"("organisationId");

-- CreateIndex
CREATE INDEX "AwayMessage_organisationId_personId_idx" ON "AwayMessage"("organisationId", "personId");

-- AddForeignKey
ALTER TABLE "MeetingBackground" ADD CONSTRAINT "MeetingBackground_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBackground" ADD CONSTRAINT "MeetingBackground_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBackground" ADD CONSTRAINT "MeetingBackground_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwayMessage" ADD CONSTRAINT "AwayMessage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwayMessage" ADD CONSTRAINT "AwayMessage_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, like every other table that holds tenant data.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MeetingBackground', 'AwayMessage'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("organisationId" = tshaeno_org() OR tshaeno_system()) WITH CHECK ("organisationId" = tshaeno_org() OR tshaeno_system())', t);
  END LOOP;
END
$$;
