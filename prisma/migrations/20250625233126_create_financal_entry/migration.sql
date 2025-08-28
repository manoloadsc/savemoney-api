/*
  Warnings:

  - Made the column `month` on table `FinancialAction` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FinancialAction" ALTER COLUMN "month" SET NOT NULL;
