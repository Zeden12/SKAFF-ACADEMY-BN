/*
  Warnings:

  - A unique constraint covering the columns `[displayOrder]` on the table `Program` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `displayOrder` to the `Program` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "displayOrder" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Program_displayOrder_key" ON "Program"("displayOrder");
