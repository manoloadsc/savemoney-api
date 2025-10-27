/*
  Warnings:

  - Added the required column `origin` to the `FinancialAction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `origin` to the `FinancialEntry` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FinancialOrigin" AS ENUM ('RECURRING', 'ONE_TIME', 'INSTALLMENT');

-- AlterTable
ALTER TABLE "FinancialAction" ADD COLUMN     "origin" "FinancialOrigin" NOT NULL;

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "origin" "FinancialOrigin" NOT NULL;
