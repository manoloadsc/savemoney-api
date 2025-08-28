/*
  Warnings:

  - You are about to drop the column `parcels` on the `FinancialAction` table. All the data in the column will be lost.
  - Added the required column `month` to the `FinancialAction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinancialAction" DROP COLUMN "parcels",
ADD COLUMN     "month" TEXT NOT NULL,
ADD COLUMN     "parcels_count" INTEGER NOT NULL DEFAULT 1;
