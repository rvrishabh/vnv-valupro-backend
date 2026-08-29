-- AlterTable
ALTER TABLE "ValuationReport" ADD COLUMN     "circleRateMohalla" TEXT,
ADD COLUMN     "roadWidthMeters" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "CircleRateArea" (
    "id" TEXT NOT NULL,
    "subRegistrarOffice" TEXT NOT NULL,
    "mohalla" TEXT NOT NULL,
    "district" TEXT,
    "areaClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircleRateArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleRateEntry" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "propertyCategory" TEXT NOT NULL,
    "roadWidthBand" TEXT NOT NULL DEFAULT 'NONE',
    "rate" DECIMAL(15,2) NOT NULL,
    "sourceValuationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleRateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleRateArea_subRegistrarOffice_idx" ON "CircleRateArea"("subRegistrarOffice");

-- CreateIndex
CREATE UNIQUE INDEX "CircleRateArea_subRegistrarOffice_mohalla_key" ON "CircleRateArea"("subRegistrarOffice", "mohalla");

-- CreateIndex
CREATE INDEX "CircleRateEntry_areaId_idx" ON "CircleRateEntry"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleRateEntry_areaId_propertyCategory_roadWidthBand_effec_key" ON "CircleRateEntry"("areaId", "propertyCategory", "roadWidthBand", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "CircleRateEntry" ADD CONSTRAINT "CircleRateEntry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "CircleRateArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleRateEntry" ADD CONSTRAINT "CircleRateEntry_sourceValuationId_fkey" FOREIGN KEY ("sourceValuationId") REFERENCES "ValuationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
