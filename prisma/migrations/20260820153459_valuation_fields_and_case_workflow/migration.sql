-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "surveyCompletedAt" TIMESTAMP(3),
ADD COLUMN     "surveyStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ValuationReport" ADD COLUMN     "advanceReceived" DECIMAL(15,2),
ADD COLUMN     "assetsSoldAsPerDeed" TEXT,
ADD COLUMN     "discrepancy" JSONB,
ADD COLUMN     "leaseDetails" JSONB,
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "siteAddress" JSONB,
ADD COLUMN     "tenure" TEXT;
