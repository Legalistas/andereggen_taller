-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "deliveryAppointmentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RepairStatusChange" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "fromStatus" "RepairStatus",
    "toStatus" "RepairStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "leadId" TEXT,
    "repairId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairStatusChange_repairId_changedAt_idx" ON "RepairStatusChange"("repairId", "changedAt");

-- CreateIndex
CREATE INDEX "NotificationLog_leadId_idx" ON "NotificationLog"("leadId");

-- CreateIndex
CREATE INDEX "NotificationLog_repairId_idx" ON "NotificationLog"("repairId");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RepairStatusChange" ADD CONSTRAINT "RepairStatusChange_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Historial de etapas: cada alta de tarjeta y cada cambio de status queda
-- registrado, venga del endpoint que venga (ficha, tablero, Caja, cobros).
CREATE FUNCTION log_repair_status_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "RepairStatusChange" ("id", "repairId", "fromStatus", "toStatus")
    VALUES (
      gen_random_uuid()::text,
      NEW."id",
      CASE WHEN TG_OP = 'UPDATE' THEN OLD."status" END,
      NEW."status"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER repair_status_change
AFTER INSERT OR UPDATE OF "status" ON "Repair"
FOR EACH ROW EXECUTE FUNCTION log_repair_status_change();
