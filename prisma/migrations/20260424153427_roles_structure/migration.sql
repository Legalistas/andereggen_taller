/*
  Warnings:

  - Added the required column `label` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "type" "RoleType" NOT NULL DEFAULT 'INTERNAL';
