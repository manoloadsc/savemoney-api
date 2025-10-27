/*
  Warnings:

  - You are about to drop the column `day` on the `Reminds` table. All the data in the column will be lost.
  - You are about to drop the column `hour` on the `Reminds` table. All the data in the column will be lost.
  - You are about to drop the column `minute` on the `Reminds` table. All the data in the column will be lost.
  - Added the required column `endMonth` to the `FinancialEntry` table without a default value. This is not possible if the table is not empty.
  - Made the column `startMonth` on table `FinancialEntry` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `date` to the `Reminds` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "endMonth" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "startMonth" SET NOT NULL,
ALTER COLUMN "startMonth" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reminds" DROP COLUMN "day",
DROP COLUMN "hour",
DROP COLUMN "minute",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;
