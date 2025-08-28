-- AlterTable
ALTER TABLE "Notifications" ADD COLUMN     "categoryId" INTEGER NOT NULL DEFAULT 19,
ADD COLUMN     "type" "FinancialType" NOT NULL DEFAULT 'GASTO';

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
