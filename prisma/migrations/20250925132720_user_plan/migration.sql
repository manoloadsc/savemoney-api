/*
  Warnings:

  - You are about to drop the column `hotmartSubscriptionCode` on the `UserPlan` table. All the data in the column will be lost.
  - The `status` column on the `UserPlan` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "UserPlan_hotmartSubscriptionCode_key";

-- AlterTable
ALTER TABLE "UserPlan" DROP COLUMN "hotmartSubscriptionCode",
ALTER COLUMN "startDate" SET DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "status",
ADD COLUMN     "status" BOOLEAN DEFAULT true;

-- CreateIndex
CREATE INDEX "UserPlan_userId_status_idx" ON "UserPlan"("userId", "status");
