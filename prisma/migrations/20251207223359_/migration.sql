/*
  Warnings:

  - You are about to drop the column `whopMembershipId` on the `UserPlan` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[whopPaymentId]` on the table `UserPlan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserPlan_whopMembershipId_idx";

-- DropIndex
DROP INDEX "UserPlan_whopMembershipId_key";

-- AlterTable
ALTER TABLE "UserPlan" DROP COLUMN "whopMembershipId",
ADD COLUMN     "whopPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserPlan_whopPaymentId_key" ON "UserPlan"("whopPaymentId");

-- CreateIndex
CREATE INDEX "UserPlan_whopPaymentId_idx" ON "UserPlan"("whopPaymentId");
