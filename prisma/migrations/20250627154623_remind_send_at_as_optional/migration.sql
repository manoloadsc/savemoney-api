/*
  Warnings:

  - You are about to drop the column `sended_at` on the `Reminds` table. All the data in the column will be lost.
  - Added the required column `send_at` to the `Reminds` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reminds" DROP COLUMN "sended_at",
ADD COLUMN     "send_at" TIMESTAMP(3) NOT NULL;
