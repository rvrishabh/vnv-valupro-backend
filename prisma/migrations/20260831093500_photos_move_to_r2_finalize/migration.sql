-- AlterTable
-- `data`'s existing rows were already backfilled to R2 (see key/url) before
-- this migration runs, so dropping it here loses nothing.
ALTER TABLE "ValuationPhoto" DROP COLUMN "data",
ALTER COLUMN "key" SET NOT NULL,
ALTER COLUMN "url" SET NOT NULL;
