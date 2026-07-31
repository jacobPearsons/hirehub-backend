-- CreateEnum
CREATE TYPE "CompanyInviteStatus" AS ENUM ('PENDING');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "employmentType" VARCHAR(50),
ADD COLUMN     "headline" VARCHAR(120),
ADD COLUMN     "location" VARCHAR(100),
ADD COLUMN     "remoteOnly" BOOLEAN DEFAULT false,
ADD COLUMN     "resumeFileName" VARCHAR(255),
ADD COLUMN     "resumePath" VARCHAR(255),
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "company_invites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" "CompanyInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_invites_companyId_email_key" ON "company_invites"("companyId", "email");

-- AddForeignKey
ALTER TABLE "company_invites" ADD CONSTRAINT "company_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
