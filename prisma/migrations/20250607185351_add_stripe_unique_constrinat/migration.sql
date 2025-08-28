/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `Users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Users_stripeCustomerId_key" ON "Users"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Users_stripeSubscriptionId_key" ON "Users"("stripeSubscriptionId");
