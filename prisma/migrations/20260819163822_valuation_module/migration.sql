/*
  Warnings:

  - You are about to drop the column `builtUpArea` on the `ValuationReport` table. All the data in the column will be lost.
  - You are about to drop the column `constructionAge` on the `ValuationReport` table. All the data in the column will be lost.
  - You are about to drop the column `constructionQuality` on the `ValuationReport` table. All the data in the column will be lost.
  - You are about to drop the column `plotArea` on the `ValuationReport` table. All the data in the column will be lost.
  - The `floors` column on the `ValuationReport` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('LAND_AND_BUILDING', 'CRM', 'PLOT');

-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ValuationReport" DROP COLUMN "builtUpArea",
DROP COLUMN "constructionAge",
DROP COLUMN "constructionQuality",
DROP COLUMN "plotArea",
ADD COLUMN     "adoptedRate" DECIMAL(15,2),
ADD COLUMN     "areaUnit" TEXT DEFAULT 'Sq.m',
ADD COLUMN     "boundaries" JSONB,
ADD COLUMN     "buildingSpecs" JSONB,
ADD COLUMN     "buildingValueDepreciated" DECIMAL(15,2),
ADD COLUMN     "circleRate" DECIMAL(15,2),
ADD COLUMN     "compositeRate" DECIMAL(15,2),
ADD COLUMN     "computed" JSONB,
ADD COLUMN     "computedAt" TIMESTAMP(3),
ADD COLUMN     "depreciatedBuildingRate" DECIMAL(15,2),
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "engineVersion" TEXT,
ADD COLUMN     "expectedLifeYears" INTEGER DEFAULT 80,
ADD COLUMN     "extraItems" JSONB,
ADD COLUMN     "extraItemsValue" DECIMAL(15,2),
ADD COLUMN     "fairMarketValue" DECIMAL(15,2),
ADD COLUMN     "farAchieved" DECIMAL(6,2),
ADD COLUMN     "generalDetails" JSONB,
ADD COLUMN     "groundCoveragePercent" DECIMAL(6,2),
ADD COLUMN     "guidelineConstructionValue" DECIMAL(15,2),
ADD COLUMN     "guidelineLandValue" DECIMAL(15,2),
ADD COLUMN     "guidelineTotalValue" DECIMAL(15,2),
ADD COLUMN     "insurableValue" DECIMAL(15,2),
ADD COLUMN     "landComponentRate" DECIMAL(15,2),
ADD COLUMN     "landValue" DECIMAL(15,2),
ADD COLUMN     "method" "ValuationMethod" NOT NULL DEFAULT 'LAND_AND_BUILDING',
ADD COLUMN     "plotAreaSqM" DECIMAL(12,2),
ADD COLUMN     "plotPosition" TEXT,
ADD COLUMN     "prevailingMarketRate" DECIMAL(15,2),
ADD COLUMN     "realizableValue" DECIMAL(15,2),
ADD COLUMN     "reportYear" INTEGER,
ADD COLUMN     "roundedMarketValue" DECIMAL(15,2),
ADD COLUMN     "services" JSONB,
ADD COLUMN     "siteVisit" JSONB,
ADD COLUMN     "status" "ValuationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "superAreaPercent" DECIMAL(6,4) DEFAULT 0,
ADD COLUMN     "tehsil" TEXT,
ADD COLUMN     "titleDeed" JSONB,
ADD COLUMN     "totalMarketValue" DECIMAL(15,2),
ADD COLUMN     "yearOfConstruction" INTEGER,
DROP COLUMN "floors",
ADD COLUMN     "floors" JSONB;

-- CreateTable
CREATE TABLE "ConstructionRate" (
    "id" TEXT NOT NULL,
    "tehsil" TEXT NOT NULL,
    "roofType" TEXT NOT NULL,
    "category" INTEGER NOT NULL DEFAULT 1,
    "rate" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleRate" (
    "id" TEXT NOT NULL,
    "tehsil" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "rate" DECIMAL(15,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Sq.m',
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircleRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationOption" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReportTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "sections" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConstructionRate_tehsil_idx" ON "ConstructionRate"("tehsil");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionRate_tehsil_roofType_category_key" ON "ConstructionRate"("tehsil", "roofType", "category");

-- CreateIndex
CREATE INDEX "CircleRate_tehsil_idx" ON "CircleRate"("tehsil");

-- CreateIndex
CREATE UNIQUE INDEX "CircleRate_tehsil_locality_key" ON "CircleRate"("tehsil", "locality");

-- CreateIndex
CREATE INDEX "ValuationOption_group_idx" ON "ValuationOption"("group");

-- CreateIndex
CREATE UNIQUE INDEX "ValuationOption_group_value_key" ON "ValuationOption"("group", "value");

-- CreateIndex
CREATE UNIQUE INDEX "BankReportTemplate_institutionId_key" ON "BankReportTemplate"("institutionId");

-- CreateIndex
CREATE INDEX "ValuationReport_status_idx" ON "ValuationReport"("status");

-- CreateIndex
CREATE INDEX "ValuationReport_engineerId_idx" ON "ValuationReport"("engineerId");

-- AddForeignKey
ALTER TABLE "BankReportTemplate" ADD CONSTRAINT "BankReportTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
