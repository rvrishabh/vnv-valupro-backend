-- AlterTable
ALTER TABLE "ValuationReport" ADD COLUMN     "areaBasis" TEXT,
ADD COLUMN     "briefDescription" TEXT,
ADD COLUMN     "documentsReceived" TEXT,
ADD COLUMN     "floorDetails" JSONB,
ADD COLUMN     "gpsCoordinates" TEXT,
ADD COLUMN     "rooms" JSONB,
ADD COLUMN     "undividedShareOfLand" DECIMAL(12,2);
