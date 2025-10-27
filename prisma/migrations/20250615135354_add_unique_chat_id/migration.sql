/*
  Warnings:

  - A unique constraint covering the columns `[chat_id]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Users_chat_id_key" ON "Users"("chat_id");
