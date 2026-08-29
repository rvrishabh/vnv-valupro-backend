-- CreateTable
CREATE TABLE "ValuationPhoto" (
    "id" TEXT NOT NULL,
    "valuationId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValuationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValuationPhoto_valuationId_section_idx" ON "ValuationPhoto"("valuationId", "section");

-- AddForeignKey
ALTER TABLE "ValuationPhoto" ADD CONSTRAINT "ValuationPhoto_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "ValuationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
