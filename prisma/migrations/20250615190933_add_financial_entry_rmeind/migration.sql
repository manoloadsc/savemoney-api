-- CreateTable
CREATE TABLE "Reminds" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,

    CONSTRAINT "Reminds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reminds_entryId_key" ON "Reminds"("entryId");

-- AddForeignKey
ALTER TABLE "Reminds" ADD CONSTRAINT "Reminds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminds" ADD CONSTRAINT "Reminds_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
