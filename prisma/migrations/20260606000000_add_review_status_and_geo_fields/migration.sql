-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
-- New columns are added with reviewStatus defaulting to PENDING so that NEW rows
-- inserted after this migration land in the review queue.
ALTER TABLE "Asset" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "aiSuggestions" JSONB,
ADD COLUMN     "gpsLat" DOUBLE PRECISION,
ADD COLUMN     "gpsLng" DOUBLE PRECISION,
ADD COLUMN     "areaSlug" TEXT,
ADD COLUMN     "exifTakenAt" TIMESTAMP(3);

-- Backfill: every Asset that already exists before this migration is content that is
-- already live on the site, so mark it APPROVED rather than dropping it into the future
-- review queue. All rows present at migration time are pre-existing, so no WHERE clause
-- is required; the column default of PENDING continues to apply to rows created later.
UPDATE "Asset" SET "reviewStatus" = 'APPROVED';
