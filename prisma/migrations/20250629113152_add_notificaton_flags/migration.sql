/*
  Warnings:

  - You are about to drop the column `parcelId` on the `Notifications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `Notifications` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Notifications" DROP CONSTRAINT "Notifications_parcelId_fkey";

-- DropIndex
DROP INDEX "Notifications_parcelId_key";

-- AlterTable
ALTER TABLE "NotificationMessage" ADD COLUMN     "answerTime" TIMESTAMP(3),
ADD COLUMN     "viwedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notifications" DROP COLUMN "parcelId";

-- CreateIndex
CREATE UNIQUE INDEX "Notifications_transactionId_key" ON "Notifications"("transactionId");
