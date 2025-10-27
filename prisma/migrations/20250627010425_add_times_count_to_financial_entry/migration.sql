/*
  Warnings:

  - Added the required column `times_count` to the `FinancialEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "times_count" INTEGER NOT NULL;
