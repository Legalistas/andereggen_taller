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
    "order" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPart_pkey" PRIMARY KEY ("id")
);

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
