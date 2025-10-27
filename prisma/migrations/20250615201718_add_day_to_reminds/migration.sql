/*
  Warnings:

  - Added the required column `day` to the `Reminds` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reminds" ADD COLUMN     "day" INTEGER NOT NULL;
