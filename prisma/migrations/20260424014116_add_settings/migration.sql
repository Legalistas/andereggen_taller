-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "companyName" TEXT NOT NULL DEFAULT 'Andereggen Taller Automotor',
    "companyAddress" TEXT NOT NULL DEFAULT 'Aconcagua 663 — Rafaela, Santa Fe',
    "companyCuit" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "companyWebsite" TEXT,
    "companyLogoUrl" TEXT,
    "defaultIvaRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    "defaultValidityDays" INTEGER NOT NULL DEFAULT 10,
    "defaultDeliveryDays" INTEGER NOT NULL DEFAULT 20,
    "defaultPaymentCondition" TEXT NOT NULL DEFAULT 'Contado contra entrega',
    "notifyOnLeadCreated" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBudgetSent" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBudgetReminder" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnStageChange" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysAfterSent" INTEGER NOT NULL DEFAULT 5,
    "locale" TEXT NOT NULL DEFAULT 'es-AR',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "whatsappApiKey" TEXT,
    "mpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mpAccessToken" TEXT,
    "afipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "afipCuit" TEXT,
    "afipCertNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_name_key" ON "InsuranceCompany"("name");

-- CreateIndex
CREATE INDEX "InsuranceCompany_isActive_idx" ON "InsuranceCompany"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_key_key" ON "LeadSource"("key");

-- CreateIndex
CREATE INDEX "LeadSource_isActive_idx" ON "LeadSource"("isActive");
