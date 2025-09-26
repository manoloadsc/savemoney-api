/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `Users` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `Users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Users_stripeCustomerId_key";

-- DropIndex
DROP INDEX "Users_stripeSubscriptionId_key";

-- AlterTable
ALTER TABLE "Users" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId";
