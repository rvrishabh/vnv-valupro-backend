-- CreateTable: InstitutionType
CREATE TABLE "InstitutionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionType_name_key" ON "InstitutionType"("name");

-- Seed default Bank institution type
INSERT INTO "InstitutionType" ("id", "name", "description", "createdAt")
VALUES (gen_random_uuid()::text, 'Bank', 'Scheduled commercial banks regulated by RBI', CURRENT_TIMESTAMP);

-- CreateTable: Institution
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");
CREATE INDEX "Institution_institutionTypeId_idx" ON "Institution"("institutionTypeId");

-- Migrate Bank rows into Institution (preserve IDs for FK remapping)
INSERT INTO "Institution" ("id", "name", "code", "institutionTypeId", "isActive", "createdAt")
SELECT
    b."id",
    b."name",
    b."code",
    (SELECT "id" FROM "InstitutionType" WHERE "name" = 'Bank' LIMIT 1),
    b."isActive",
    b."createdAt"
FROM "Bank" b;

ALTER TABLE "Institution" ADD CONSTRAINT "Institution_institutionTypeId_fkey"
    FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Branch
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "ifscCode" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "isManuallyEntered" BOOLEAN NOT NULL DEFAULT false,
    "needsVerification" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Branch_ifscCode_key" ON "Branch"("ifscCode");
CREATE INDEX "Branch_institutionId_idx" ON "Branch"("institutionId");
CREATE INDEX "Branch_city_idx" ON "Branch"("city");
CREATE INDEX "Branch_needsVerification_idx" ON "Branch"("needsVerification");
CREATE UNIQUE INDEX "Branch_institutionId_branchName_city_key" ON "Branch"("institutionId", "branchName", "city");

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User: add new columns, migrate bankId -> institutionId
ALTER TABLE "User" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "User" ADD COLUMN "branchId" TEXT;

UPDATE "User" SET "institutionId" = "bankId" WHERE "bankId" IS NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_bankId_fkey";
ALTER TABLE "User" DROP COLUMN "bankId";

ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Case: add new columns, migrate bankId -> institutionId
ALTER TABLE "Case" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Case" ADD COLUMN "branchId" TEXT;

UPDATE "Case" SET "institutionId" = "bankId" WHERE "bankId" IS NOT NULL;

ALTER TABLE "Case" DROP CONSTRAINT IF EXISTS "Case_bankId_fkey";
DROP INDEX IF EXISTS "Case_bankId_idx";
ALTER TABLE "Case" DROP COLUMN "bankId";

ALTER TABLE "Case" ALTER COLUMN "institutionId" SET NOT NULL;

CREATE INDEX "Case_institutionId_idx" ON "Case"("institutionId");
CREATE INDEX "Case_branchId_idx" ON "Case"("branchId");

ALTER TABLE "Case" ADD CONSTRAINT "Case_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old Bank table
DROP TABLE "Bank";
