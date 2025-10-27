-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'pt', 'es');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'BRL', 'MXN', 'CLP', 'ARS', 'PYG', 'COP', 'BOB', 'UYU', 'PEN');

-- DropForeignKey
ALTER TABLE "Messages" DROP CONSTRAINT "Messages_clientId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationMessage" DROP CONSTRAINT "NotificationMessage_notificationId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationMessage" DROP CONSTRAINT "NotificationMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notifications" DROP CONSTRAINT "Notifications_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Notifications" DROP CONSTRAINT "Notifications_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Notifications" DROP CONSTRAINT "Notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "Parcels" DROP CONSTRAINT "Parcels_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "Parcels" DROP CONSTRAINT "Parcels_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "authCode" DROP CONSTRAINT "authCode_userId_fkey";

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "completeInformation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currency" "Currency" DEFAULT 'BRL',
ADD COLUMN     "lang" "Language" DEFAULT 'pt';

-- CreateTable
CREATE TABLE "customerPayments" (
    "customerId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "payedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customerPayments_pkey" PRIMARY KEY ("customerId")
);

-- AddForeignKey
ALTER TABLE "authCode" ADD CONSTRAINT "authCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcels" ADD CONSTRAINT "Parcels_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcels" ADD CONSTRAINT "Parcels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
