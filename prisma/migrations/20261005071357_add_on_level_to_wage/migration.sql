/*
  Warnings:

  - You are about to drop the column `toReviewLevel` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "toReviewLevel";

-- AlterTable
ALTER TABLE "Wage" ADD COLUMN     "onLevel" INTEGER NOT NULL DEFAULT 0;
