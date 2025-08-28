-- CreateEnum
CREATE TYPE "NotificationResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- DropEnum
DROP TYPE "FinancialOrigin";

-- CreateTable
CREATE TABLE "NotificationMessage" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "status" "NotificationResponseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationMessage_notificationId_month_key" ON "NotificationMessage"("notificationId", "month");

-- AddForeignKey
ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
