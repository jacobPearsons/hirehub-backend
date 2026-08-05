-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- Backfill existing jobs so public listing keeps showing legacy rows (strict > now() filter)
UPDATE "Job" SET "expiresAt" = "postedDate" + INTERVAL '7 days' WHERE "expiresAt" IS NULL;
