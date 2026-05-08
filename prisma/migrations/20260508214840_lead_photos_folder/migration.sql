-- AlterTable
ALTER TABLE "BudgetAdminQuote" ALTER COLUMN "photos" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "photosFolder" VARCHAR(255);
