-- CreateEnum
CREATE TYPE "FinancialType" AS ENUM ('GANHO', 'GASTO');

-- CreateEnum
CREATE TYPE "FromMessage" AS ENUM ('BOT', 'USER');

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Messages" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from" "FromMessage" NOT NULL,

    CONSTRAINT "Messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FinancialType" NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAction" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "recorrente" BOOLEAN NOT NULL,
    "parcels" INTEGER NOT NULL DEFAULT 1,
    "value" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "FinancialAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Messages" ADD CONSTRAINT "Messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAction" ADD CONSTRAINT "FinancialAction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
