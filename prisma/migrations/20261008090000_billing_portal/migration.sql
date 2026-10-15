-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BWP', 'ZAR', 'USD');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'FREE', 'ACTIVE', 'PAST_DUE');

-- CreateEnum
CREATE TYPE "BilledBy" AS ENUM ('DIRECT', 'PARTNER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('NEW', 'RENEWAL', 'SEATS');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DPO', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "firstSignatureAt" TIMESTAMP(3),
ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portalPhoto" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "socials" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "currency" "Currency" NOT NULL,
    "monthlyMinor" INTEGER NOT NULL,
    "annualMinor" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billedBy" "BilledBy" NOT NULL DEFAULT 'DIRECT',
    "tier" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "seats" INTEGER NOT NULL DEFAULT 0,
    "renewalSeats" INTEGER,
    "trialEndsAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "customMinor" INTEGER,
    "showBadge" BOOLEAN NOT NULL DEFAULT false,
    "billingName" TEXT NOT NULL DEFAULT '',
    "billingEmail" TEXT NOT NULL DEFAULT '',
    "billingAddress" TEXT NOT NULL DEFAULT '',
    "taxNumber" TEXT NOT NULL DEFAULT '',
    "trialReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "method" "PaymentMethod" NOT NULL,
    "currency" "Currency" NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "seats" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "billTo" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "dpoToken" TEXT,
    "paymentRef" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "PortalLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "linkHash" TEXT,
    "linkExpiresAt" TIMESTAMP(3) NOT NULL,
    "sessionHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_tier_currency_key" ON "PlanPrice"("tier", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_dpoToken_key" ON "Invoice"("dpoToken");

-- CreateIndex
CREATE INDEX "Invoice_organisationId_issuedAt_idx" ON "Invoice"("organisationId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_status_method_idx" ON "Invoice"("status", "method");

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_linkHash_key" ON "PortalLink"("linkHash");

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_sessionHash_key" ON "PortalLink"("sessionHash");

-- CreateIndex
CREATE INDEX "PortalLink_personId_idx" ON "PortalLink"("personId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Row-level security ─────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Subscription','Invoice','PortalLink'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING ("organisationId" = tshaeno_org() OR tshaeno_system()) WITH CHECK ("organisationId" = tshaeno_org() OR tshaeno_system())', t);
  END LOOP;
END
$$;

-- ─── Starting prices, per person per month in cents ────────────────
-- Annual is two months free. Staff change these in the platform admin area.

INSERT INTO "PlanPrice" ("id", "tier", "currency", "monthlyMinor", "annualMinor", "updatedAt") VALUES
  ('price_starter_usd', 'STARTER', 'USD', 150, 125, now()),
  ('price_growth_usd', 'GROWTH', 'USD', 125, 104, now()),
  ('price_business_usd', 'BUSINESS', 'USD', 100, 83, now()),
  ('price_starter_zar', 'STARTER', 'ZAR', 2700, 2250, now()),
  ('price_growth_zar', 'GROWTH', 'ZAR', 2300, 1917, now()),
  ('price_business_zar', 'BUSINESS', 'ZAR', 1800, 1500, now()),
  ('price_starter_bwp', 'STARTER', 'BWP', 2000, 1667, now()),
  ('price_growth_bwp', 'GROWTH', 'BWP', 1700, 1417, now()),
  ('price_business_bwp', 'BUSINESS', 'BWP', 1350, 1125, now());

-- Organisations that already exist start a 14 day trial.
INSERT INTO "Subscription" ("id", "organisationId", "status", "trialEndsAt", "updatedAt")
SELECT 'sub_' || "id", "id", 'TRIALING', now() + interval '14 days', now() FROM "Organisation";
