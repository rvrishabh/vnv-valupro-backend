-- CreateTable
CREATE TABLE "ValuationConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationEstimate" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "plotAreaSqFt" DOUBLE PRECISION NOT NULL,
    "plotAreaSqM" DOUBLE PRECISION NOT NULL,
    "estimatedAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "coveragePercent" DOUBLE PRECISION NOT NULL,
    "totalPermissibleAreaSqFt" DOUBLE PRECISION NOT NULL,
    "groundFloorAreaSqFt" DOUBLE PRECISION NOT NULL,
    "floorBreakdown" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValuationConfig_key_key" ON "ValuationConfig"("key");

-- CreateIndex
CREATE INDEX "ValuationEstimate_createdBy_idx" ON "ValuationEstimate"("createdBy");

-- AddForeignKey
ALTER TABLE "ValuationEstimate" ADD CONSTRAINT "ValuationEstimate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
