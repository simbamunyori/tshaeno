-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 480,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "scope" "AssignmentScope" NOT NULL DEFAULT 'EVERYONE',
    "department" TEXT,
    "groupName" TEXT,
    "location" TEXT,
    "audience" "Audience" NOT NULL DEFAULT 'EXTERNAL',
    "forNew" BOOLEAN NOT NULL DEFAULT true,
    "forReply" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "startPushedAt" TIMESTAMP(3),
    "endPushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignClick" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "senderId" TEXT,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_key_key" ON "Campaign"("key");

-- CreateIndex
CREATE INDEX "Campaign_organisationId_idx" ON "Campaign"("organisationId");

-- CreateIndex
CREATE INDEX "CampaignClick_organisationId_createdAt_idx" ON "CampaignClick"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignClick_campaignId_createdAt_idx" ON "CampaignClick"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignClick_campaignId_visitorHash_key" ON "CampaignClick"("campaignId", "visitorHash");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignClick" ADD CONSTRAINT "CampaignClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security, like every other table that holds tenant data.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Campaign', 'CampaignClick'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("organisationId" = tshaeno_org() OR tshaeno_system()) WITH CHECK ("organisationId" = tshaeno_org() OR tshaeno_system())', t);
  END LOOP;
END
$$;
