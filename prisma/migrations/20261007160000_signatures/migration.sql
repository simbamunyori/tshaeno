-- CreateEnum
CREATE TYPE "PersonSource" AS ENUM ('MANUAL', 'CSV', 'GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('LOGO', 'PHOTO', 'BANNER', 'IMAGE');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('VISUAL', 'HTML');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('EVERYONE', 'DEPARTMENT', 'PERSON');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "photoAssetId" TEXT,
    "custom" JSONB NOT NULL DEFAULT '{}',
    "source" "PersonSource" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "logoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "brandKitId" TEXT,
    "draft" JSONB NOT NULL,
    "starterKey" TEXT,
    "publishedVersionId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "content" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureAssignment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scope" "AssignmentScope" NOT NULL,
    "department" TEXT,
    "personId" TEXT,
    "forNew" BOOLEAN NOT NULL DEFAULT true,
    "forReply" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_organisationId_department_idx" ON "Person"("organisationId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "Person_organisationId_email_key" ON "Person"("organisationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_organisationId_key_key" ON "CustomField"("organisationId", "key");

-- CreateIndex
CREATE INDEX "Asset_organisationId_kind_idx" ON "Asset"("organisationId", "kind");

-- CreateIndex
CREATE INDEX "BrandKit_organisationId_idx" ON "BrandKit"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureTemplate_publishedVersionId_key" ON "SignatureTemplate"("publishedVersionId");

-- CreateIndex
CREATE INDEX "SignatureTemplate_organisationId_idx" ON "SignatureTemplate"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureVersion_templateId_number_key" ON "SignatureVersion"("templateId", "number");

-- CreateIndex
CREATE INDEX "SignatureAssignment_organisationId_templateId_idx" ON "SignatureAssignment"("organisationId", "templateId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_photoAssetId_fkey" FOREIGN KEY ("photoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "SignatureVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureVersion" ADD CONSTRAINT "SignatureVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureVersion" ADD CONSTRAINT "SignatureVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAssignment" ADD CONSTRAINT "SignatureAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAssignment" ADD CONSTRAINT "SignatureAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureAssignment" ADD CONSTRAINT "SignatureAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Row-level security ─────────────────────────────────────────────
-- Every signature table belongs to one organisation, and only that
-- organisation's scope can see or change its rows.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Person','CustomField','Asset','BrandKit','SignatureTemplate','SignatureVersion','SignatureAssignment'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("organisationId" = tshaeno_org() OR tshaeno_system()) WITH CHECK ("organisationId" = tshaeno_org() OR tshaeno_system())', t);
  END LOOP;
END
$$;
