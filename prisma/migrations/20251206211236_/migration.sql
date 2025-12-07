/*
  Warnings:

  - A unique constraint covering the columns `[whopMembershipId]` on the table `UserPlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[whopUserId]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "UserPlan" ADD COLUMN     "whopMembershipId" TEXT;

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "whopUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserPlan_whopMembershipId_key" ON "UserPlan"("whopMembershipId");

-- CreateIndex
CREATE INDEX "UserPlan_whopMembershipId_idx" ON "UserPlan"("whopMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Users_whopUserId_key" ON "Users"("whopUserId");
