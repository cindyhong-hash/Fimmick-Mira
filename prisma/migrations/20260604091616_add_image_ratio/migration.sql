-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "focusPoint" TEXT NOT NULL,
    "titleText" TEXT,
    "subtitleText" TEXT,
    "imagePrompt" TEXT,
    "productImageUrl" TEXT NOT NULL DEFAULT '',
    "productImageUrls" TEXT NOT NULL DEFAULT '[]',
    "referenceImageUrls" TEXT NOT NULL DEFAULT '[]',
    "selectedComponentIds" TEXT NOT NULL DEFAULT '[]',
    "imageRatio" TEXT NOT NULL DEFAULT '1:1',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("clientId", "createdAt", "focusPoint", "id", "imagePrompt", "productImageUrl", "productImageUrls", "referenceImageUrls", "selectedComponentIds", "status", "subtitleText", "theme", "titleText") SELECT "clientId", "createdAt", "focusPoint", "id", "imagePrompt", "productImageUrl", "productImageUrls", "referenceImageUrls", "selectedComponentIds", "status", "subtitleText", "theme", "titleText" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
