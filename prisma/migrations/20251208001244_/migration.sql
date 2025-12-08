/*
  Warnings:

  - You are about to drop the column `whopPaymentId` on the `UserPlan` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UserPlan_whopPaymentId_idx";

-- DropIndex
DROP INDEX "UserPlan_whopPaymentId_key";

-- AlterTable
ALTER TABLE "UserPlan" DROP COLUMN "whopPaymentId";
