-- AlterTable
ALTER TABLE "ValuationReport" ADD COLUMN     "areaAsPerDeed" DECIMAL(12,2),
ADD COLUMN     "areaAsPerSite" DECIMAL(12,2),
ADD COLUMN     "dimensionUnit" TEXT DEFAULT 'ft';
