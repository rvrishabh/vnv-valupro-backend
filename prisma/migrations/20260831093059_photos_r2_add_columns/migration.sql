-- AlterTable
ALTER TABLE "ValuationPhoto" ADD COLUMN     "key" TEXT,
ADD COLUMN     "url" TEXT,
ALTER COLUMN "data" DROP NOT NULL;
