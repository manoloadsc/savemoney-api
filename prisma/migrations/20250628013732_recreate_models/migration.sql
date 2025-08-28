/*
  Warnings:

  - You are about to drop the `FinancialAction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinancialEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessageLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reminds` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Interval" AS ENUM ('WEECKLY', 'MONTHLY', 'DIARY', 'YEARLY');

-- CreateEnum
CREATE TYPE "EntryRemindType" AS ENUM ('REMIND_ONLY', 'REMIND_TOO', 'NO_REMIND');

-- CreateEnum
CREATE TYPE "notificationPurpose" AS ENUM ('INFO', 'CONFIRM');

-- DropForeignKey
ALTER TABLE "FinancialAction" DROP CONSTRAINT "FinancialAction_contractId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialEntry" DROP CONSTRAINT "FinancialEntry_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialEntry" DROP CONSTRAINT "FinancialEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_financialEntryId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Reminds" DROP CONSTRAINT "Reminds_entryId_fkey";

-- DropForeignKey
ALTER TABLE "Reminds" DROP CONSTRAINT "Reminds_userId_fkey";

-- DropTable
DROP TABLE "FinancialAction";

-- DropTable
DROP TABLE "FinancialEntry";

-- DropTable
DROP TABLE "MessageLog";

-- DropTable
DROP TABLE "Reminds";

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "type" "FinancialType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "recurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "recurrenceInterval" "Interval" NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "nextReferenceDate" TIMESTAMP(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "purpose" "notificationPurpose" NOT NULL,
    "isFutureGoal" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceIntervalDays" "Interval" NOT NULL,
    "recurrenceCount" INTEGER,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "nextNotificationDate" TIMESTAMP(3),
    "transactionId" INTEGER,
    "parcelId" INTEGER,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcels" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER,
    "notificationId" INTEGER,
    "value" DECIMAL(10,2) NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Parcels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notifications_parcelId_key" ON "Notifications"("parcelId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcels" ADD CONSTRAINT "Parcels_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
