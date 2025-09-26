/*
  Warnings:

  - Made the column `durationDays` on table `Plan` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "durationDays" SET NOT NULL;
