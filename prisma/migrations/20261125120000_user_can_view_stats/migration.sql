-- AlterTable
ALTER TABLE "User" ADD COLUMN "canViewStats" BOOLEAN NOT NULL DEFAULT false;

-- Brisa (andereggen.taller@gmail.com) entra a Estadísticas.
UPDATE "User" SET "canViewStats" = true
WHERE lower(email) = 'andereggen.taller@gmail.com';
