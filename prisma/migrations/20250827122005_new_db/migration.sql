-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'pt', 'es');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'BRL', 'MXN', 'CLP', 'ARS', 'PYG', 'COP', 'BOB', 'UYU', 'PEN');

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "currency" "Currency" DEFAULT 'BRL',
ADD COLUMN     "lang" "Language" DEFAULT 'pt';
