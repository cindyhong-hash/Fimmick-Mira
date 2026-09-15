-- AlterTable
ALTER TABLE "LibraryImage" ADD COLUMN "assetSubtype" TEXT;
ALTER TABLE "LibraryImage" ADD COLUMN "hasTransparentBackground" BOOLEAN;

-- CreateTable
CREATE TABLE "ProductImageSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "themeKey" TEXT,
    "themeLabel" TEXT,
    "artDirectionJson" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductImageSet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductImageSet_productId_createdAt_idx" ON "ProductImageSet"("productId", "createdAt");
