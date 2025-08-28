/*
  Warnings:

  - Added the required column `expiredAt` to the `authCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "authCode"
  ADD COLUMN "createdAt" TIMESTAMP(3) NULL,
  ADD COLUMN "expiredAt" TIMESTAMP(3) NULL;

-- Passo 2: Atualizar os registros existentes com um valor padrão temporário para expiredAt
UPDATE "authCode"
SET "createdAt" = CURRENT_TIMESTAMP,
    "expiredAt" = CURRENT_TIMESTAMP -- ou qualquer outro valor que você queira temporariamente
WHERE "createdAt" IS NULL OR "expiredAt" IS NULL;

-- Passo 3: Alterar a coluna expiredAt para NOT NULL agora que não haverá mais valores NULL
ALTER TABLE "authCode"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "expiredAt" SET NOT NULL;
