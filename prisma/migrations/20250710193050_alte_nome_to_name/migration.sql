/*
  Warnings:

  - You are about to drop the column `nome` on the `Users` table. All the data in the column will be lost.
  - Added the required column `name` to the `Users` table without a default value. This is not possible if the table is not empty.

*/
ALTER TABLE "Users" RENAME COLUMN "nome" TO "name";