import { PrismaClient, UserRole } from "@prisma/client";
import trendingJobs from "../src/prisma/data/trending-jobs.json";

const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  let created = 0;

  for (const job of trendingJobs as Array<{
    title: string;
    company: string;
    companyLogo?: string | null;
    location: string;
    remote: boolean;
    salaryMin?: number | null;
    salaryMax?: number | null;
    currency: string;
    tags: string[];
    category: string;
    seniority: string;
    description: string;
    requirements: string[];
    responsibilities: string[];
    postedDate: string;
    featured: boolean;
  }>) {
    const existing = await prisma.job.findFirst({
      where: { title: job.title, company: job.company },
      select: { id: true },
    });

    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: {
          description: job.description,
          requirements: job.requirements,
          responsibilities: job.responsibilities,
          tags: job.tags,
        },
      });
      updated++;
      continue;
    }

    const employer = await prisma.user.findFirst({
      where: { role: UserRole.EMPLOYER },
      select: { id: true },
    });
    if (!employer) {
      throw new Error("No employer exists; run npm run db:seed first");
    }

    await prisma.job.create({
      data: {
        title: job.title,
        company: job.company,
        companyLogo: job.companyLogo,
        location: job.location,
        remote: job.remote,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        tags: job.tags,
        category: job.category,
        seniority: job.seniority,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        postedDate: new Date(job.postedDate),
        featured: job.featured,
        employerId: employer.id,
      },
    });
    created++;
  }

  console.log(`  \u2713 Synced trending jobs: ${updated} updated, ${created} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
