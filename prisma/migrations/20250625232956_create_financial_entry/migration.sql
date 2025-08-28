-- Alterando a tabela FinancialEntry
-- Etapa 1: adiciona coluna temporária para data
ALTER TABLE "FinancialEntry" ADD COLUMN "startMonth_tmp" DATE;

-- Etapa 2: converte os dados da coluna string antiga para a nova coluna DATE
UPDATE "FinancialEntry"
SET "startMonth_tmp" = TO_DATE("startMonth", 'YYYY-MM-DD');

-- Etapa 3: remove a coluna antiga
ALTER TABLE "FinancialEntry" DROP COLUMN "startMonth";

-- Etapa 4: renomeia a nova coluna
ALTER TABLE "FinancialEntry" RENAME COLUMN "startMonth_tmp" TO "startMonth";

-- Agora para FinancialAction
-- Etapa 1: adiciona coluna temporária
ALTER TABLE "FinancialAction" ADD COLUMN "month_tmp" DATE;

-- Etapa 2: converte os dados da coluna string antiga para a nova coluna DATE
UPDATE "FinancialAction"
SET "month_tmp" = TO_DATE("month", 'YYYY-MM-DD');

-- Etapa 3: remove a coluna antiga
ALTER TABLE "FinancialAction" DROP COLUMN "month";

-- Etapa 4: renomeia a nova coluna
ALTER TABLE "FinancialAction" RENAME COLUMN "month_tmp" TO "month";
