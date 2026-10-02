-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED');

-- DropIndex
DROP INDEX "Category_name_key";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_orgId_key" ON "Category"("name", "orgId");

-- CreateIndex
CREATE INDEX "Correction_category_idx" ON "Correction"("category");

-- CreateIndex
CREATE INDEX "RateLimit_key_idx" ON "RateLimit"("key");
