-- CreateTable
CREATE TABLE "BudgetEmailLog" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "recipients" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "messageBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMsg" TEXT,
    "messageId" TEXT,

    CONSTRAINT "BudgetEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetEmailLog_budgetId_sentAt_idx" ON "BudgetEmailLog"("budgetId", "sentAt");

-- AddForeignKey
ALTER TABLE "BudgetEmailLog" ADD CONSTRAINT "BudgetEmailLog_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEmailLog" ADD CONSTRAINT "BudgetEmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
