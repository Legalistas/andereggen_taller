-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('solicitud', 'control', 'enviado', 'refuerzo', 'ganado', 'perdido');

-- CreateEnum
CREATE TYPE "LeadLostReason" AS ENUM ('precio', 'demora', 'no_respondio', 'competencia', 'otro');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "ConceptType" AS ENUM ('DESCRIPTIVO', 'UNIDADES', 'FIJO');

-- CreateEnum
CREATE TYPE "ConceptCategory" AS ENUM ('DESMONTAR', 'DESMONTAR_Y_REPARAR', 'DESMONTAR_Y_CAMBIAR', 'BANCADA_DE_ESTIRAMIENTO', 'DESABOLLAR', 'CHAPA', 'PINTURA', 'MECANICA', 'ALINEACION_BALANCEO', 'AIRE_ACONDICIONADO', 'AIRBAGS', 'COLOCACION_PARABRISAS', 'COLOCACION_LUNETA', 'PULIDO_COMPLETO', 'OTROS_ADICIONALES');

-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('CARROCERIA', 'CRISTALERIA', 'MECANICA', 'ELECTRICO', 'PINTURA', 'FRENOS', 'SUSPENSION', 'FILTROS', 'ILUMINACION', 'INTERIOR', 'OTROS');

-- CreateEnum
CREATE TYPE "PartMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "ToolCategory" AS ENUM ('NEUMATICA', 'HIDRAULICA', 'ELECTRICA', 'MANUAL', 'ELEVACION', 'SOLDADURA', 'PINTURA', 'DIAGNOSTICO', 'OTROS');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'MERCADOPAGO', 'OTRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminRole" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "lastLoginMethod" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "roleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dni" TEXT,
    "dniType" TEXT,
    "countryId" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cp" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "roleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVehicle" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "secure" TEXT NOT NULL,
    "thirdPartySecure" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'solicitud',
    "notes" TEXT,
    "lostReason" "LeadLostReason",
    "lostNotes" TEXT,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'draft',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerDni" TEXT,
    "customerAddress" TEXT,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" TEXT NOT NULL,
    "vehicleDomain" TEXT NOT NULL,
    "vehicleInsurance" TEXT,
    "laborSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ivaRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    "ivaAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "laborTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "partsSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "validityDays" INTEGER NOT NULL DEFAULT 10,
    "deliveryDays" INTEGER NOT NULL DEFAULT 20,
    "paymentCondition" TEXT NOT NULL DEFAULT 'Contado contra entrega',
    "observations" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetConcept" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "type" "ConceptType" NOT NULL,
    "category" "ConceptCategory" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "subdetails" TEXT[],
    "additionalDetail" TEXT,
    "units" DECIMAL(10,2),
    "unitValue" DECIMAL(14,2),
    "fixedAmount" DECIMAL(14,2),
    "fixedDescription" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPart" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "partId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "appliesTo" TEXT,
    "category" "PartCategory" NOT NULL DEFAULT 'OTROS',
    "costPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockMin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartMovement" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" "PartMovementType" NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "budgetId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" "ToolCategory" NOT NULL DEFAULT 'OTROS',
    "status" "ToolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedToId" TEXT,
    "location" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_countryId_key" ON "State"("name", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_countryId_idx" ON "Customer"("countryId");

-- CreateIndex
CREATE INDEX "Customer_stateId_idx" ON "Customer"("stateId");

-- CreateIndex
CREATE INDEX "Customer_roleId_idx" ON "Customer"("roleId");

-- CreateIndex
CREATE INDEX "CustomerVehicle_customerId_idx" ON "CustomerVehicle"("customerId");

-- CreateIndex
CREATE INDEX "CustomerVehicle_domain_idx" ON "CustomerVehicle"("domain");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_customerId_idx" ON "Lead"("customerId");

-- CreateIndex
CREATE INDEX "Lead_vehicleId_idx" ON "Lead"("vehicleId");

-- CreateIndex
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_number_key" ON "Budget"("number");

-- CreateIndex
CREATE INDEX "Budget_leadId_idx" ON "Budget"("leadId");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE INDEX "Budget_createdById_idx" ON "Budget"("createdById");

-- CreateIndex
CREATE INDEX "BudgetConcept_budgetId_idx" ON "BudgetConcept"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetPart_budgetId_idx" ON "BudgetPart"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetPart_partId_idx" ON "BudgetPart"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");

-- CreateIndex
CREATE INDEX "Part_isActive_idx" ON "Part"("isActive");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "Part"("name");

-- CreateIndex
CREATE INDEX "PartMovement_partId_idx" ON "PartMovement"("partId");

-- CreateIndex
CREATE INDEX "PartMovement_type_idx" ON "PartMovement"("type");

-- CreateIndex
CREATE INDEX "PartMovement_budgetId_idx" ON "PartMovement"("budgetId");

-- CreateIndex
CREATE INDEX "PartMovement_createdById_idx" ON "PartMovement"("createdById");

-- CreateIndex
CREATE INDEX "PartMovement_createdAt_idx" ON "PartMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_code_key" ON "Tool"("code");

-- CreateIndex
CREATE INDEX "Tool_status_idx" ON "Tool"("status");

-- CreateIndex
CREATE INDEX "Tool_category_idx" ON "Tool"("category");

-- CreateIndex
CREATE INDEX "Tool_assignedToId_idx" ON "Tool"("assignedToId");

-- CreateIndex
CREATE INDEX "Tool_isActive_idx" ON "Tool"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_name_key" ON "InsuranceCompany"("name");

-- CreateIndex
CREATE INDEX "InsuranceCompany_isActive_idx" ON "InsuranceCompany"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_key_key" ON "LeadSource"("key");

-- CreateIndex
CREATE INDEX "LeadSource_isActive_idx" ON "LeadSource"("isActive");

-- CreateIndex
CREATE INDEX "Payment_budgetId_idx" ON "Payment"("budgetId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_createdById_idx" ON "Payment"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVehicle" ADD CONSTRAINT "CustomerVehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetConcept" ADD CONSTRAINT "BudgetConcept_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPart" ADD CONSTRAINT "BudgetPart_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPart" ADD CONSTRAINT "BudgetPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
