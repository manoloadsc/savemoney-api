-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "emailVerified_at" TIMESTAMP(3),
ADD COLUMN     "numberVerified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "authCode" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "authCode" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "authCode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "authCode" ADD CONSTRAINT "authCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
