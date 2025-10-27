/*
  Warnings:

  - Added the required column `count` to the `Parcels` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Parcels" ADD COLUMN  "count" INTEGER;

WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "transactionId" ORDER BY "createdAt") AS rn
  FROM "Parcels"
)
UPDATE "Parcels"
SET "count" = ranked.rn
FROM ranked
WHERE "Parcels".id = ranked.id;

ALTER TABLE "Parcels" ALTER COLUMN "count" SET NOT NULL;
