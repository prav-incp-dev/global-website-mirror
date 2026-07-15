-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryWallet" TEXT,
    "secondaryWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- AddColumn
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "nick" TEXT;
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN "memberId" TEXT;
ALTER TABLE "User" ADD COLUMN "parentId" TEXT;
ALTER TABLE "User" ADD COLUMN "primaryWallet" TEXT;
ALTER TABLE "User" ADD COLUMN "secondaryWallet" TEXT;

-- Backfill existing users: create a default company and assign them
INSERT INTO "Company" ("id", "name", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Our House MLM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

UPDATE "User"
SET "companyId" = (SELECT "id" FROM "Company" WHERE "name" = 'Our House MLM')
WHERE "companyId" IS NULL;

-- Make companyId required after backfill
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (self-relation)
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
