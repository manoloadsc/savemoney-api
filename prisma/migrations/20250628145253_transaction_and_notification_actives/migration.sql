-- AlterTable
ALTER TABLE "Notifications" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
