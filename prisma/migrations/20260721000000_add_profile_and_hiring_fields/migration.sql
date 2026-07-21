-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "interviewData" JSONB,
ADD COLUMN "offerData" JSONB,
ADD COLUMN "preboardingData" JSONB,
ADD COLUMN "orientationData" JSONB;
