-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cashBoxKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Brisa (andereggen.taller@gmail.com) entra a Caja pero solo ve Caja 2.
UPDATE "User" SET "cashBoxKeys" = ARRAY['caja_2']
WHERE lower(email) = 'andereggen.taller@gmail.com';
