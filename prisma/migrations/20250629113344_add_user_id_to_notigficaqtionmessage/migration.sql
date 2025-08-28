/*
  Warnings:

  - Added the required column `userId` to the `NotificationMessage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NotificationMessage" ADD COLUMN     "userId" TEXT NOT NULL;
