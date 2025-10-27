/*
  Warnings:

  - You are about to drop the column `date` on the `Reminds` table. All the data in the column will be lost.
  - You are about to drop the column `period` on the `Reminds` table. All the data in the column will be lost.
  - Added the required column `perdiod` to the `FinancialEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "last_remind_date" TIMESTAMP(3),
ADD COLUMN     "perdiod" "RemindPeriod" NOT NULL,
ADD COLUMN     "remind_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reminds" DROP COLUMN "date",
DROP COLUMN "period",
ADD COLUMN     "sended_at" TIMESTAMP(3);
