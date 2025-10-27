/*
  Warnings:

  - Added the required column `period` to the `Reminds` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RemindPeriod" AS ENUM ('DIARY', 'WEECKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Reminds" ADD COLUMN     "period" "RemindPeriod" NOT NULL;
