-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_roleId_fkey";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "roleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
