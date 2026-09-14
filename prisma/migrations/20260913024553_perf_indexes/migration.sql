-- CreateIndex
CREATE INDEX "Budget_createdAt_idx" ON "Budget"("createdAt");

-- CreateIndex
CREATE INDEX "CashMovement_type_paidAt_idx" ON "CashMovement"("type", "paidAt");

-- CreateIndex
CREATE INDEX "Purchase_updatedAt_idx" ON "Purchase"("updatedAt");

-- CreateIndex
CREATE INDEX "Repair_enteredAt_idx" ON "Repair"("enteredAt");

-- CreateIndex
CREATE INDEX "Repair_deliveredAt_idx" ON "Repair"("deliveredAt");
