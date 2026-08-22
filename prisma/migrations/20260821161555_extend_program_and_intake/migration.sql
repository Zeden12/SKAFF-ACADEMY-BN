-- DropIndex
DROP INDEX "Program_displayOrder_key";

-- AlterTable
ALTER TABLE "Intake" ADD COLUMN     "applicationsOpen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Program" ALTER COLUMN "displayOrder" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Program_displayOrder_idx" ON "Program"("displayOrder");
