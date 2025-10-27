-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "financialEntryId" INTEGER,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_userId_key" ON "MessageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_financialEntryId_key" ON "MessageLog"("financialEntryId");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
