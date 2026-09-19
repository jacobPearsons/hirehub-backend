import { prisma } from '../../lib/prisma'
import { MatchBody } from './match.schema'

interface ScoreBreakdown {
  skills: number
  style: number
  culture: number
}

interface MatchResult {
  job: any
  score: number
  breakdown: ScoreBreakdown
}

const MAX_CULTURE_DISTANCE = 4

const WORK_STYLE_KEYWORDS: readonly (readonly string[])[] = [
  ['focus'],
  ['collab', 'pair', 'critique', 'workshop', 'community'],
  ['ritual', 'process', 'spec', 'document', 'cadence', 'rollout'],
]

export class MatchService {
  async rankJobs(answers: MatchBody): Promise<{ matches: MatchResult[]; total: number }> {
    const jobs = await prisma.job.findMany({
      include: {
        skills: { include: { skill: true } },
        employer: { include: { company: true } },
      },
    })

    const results: MatchResult[] = jobs.map(job => {
      const jobSkillSlugs = job.skills.map(js => js.skill.slug)
      const score = this.scoreJob(answers, job, jobSkillSlugs)
      return { job, ...score }
    })

    results.sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.job.postedDate).getTime() - new Date(a.job.postedDate).getTime(),
    )

    return { matches: results.slice(0, 20), total: results.length }
  }

  private scoreJob(
    answers: MatchBody,
    job: { workStyles: string[] | null; remote: boolean | null; cultureAutonomy: number | null; culturePace: number | null },
    jobSkillSlugs: string[],
  ): { score: number; breakdown: ScoreBreakdown } {
    const skills = this.scoreSkills(answers.skills, jobSkillSlugs)
    const style = this.scoreStyle(answers.logistics, answers.workStyle, job.remote, job.workStyles)
    const culture = this.scoreCulture(answers.cultureAutonomy, answers.culturePace, job.cultureAutonomy, job.culturePace)
    return {
      score: skills + style + culture,
      breakdown: { skills, style, culture },
    }
  }

  private scoreSkills(userSkills: string[], jobSkillSlugs: string[]): number {
    if (userSkills.length === 0) return 0
    const jobSet = new Set(jobSkillSlugs)
    const matched = userSkills.filter(s => jobSet.has(s)).length
    return Math.round((matched / userSkills.length) * 50)
  }

  private scoreStyle(
    logistics: string,
    workStyle: string,
    remote: boolean | null,
    workStyles: string[] | null,
  ): number {
    let points = 0

    const logisticsLower = logistics.toLowerCase()
    if (logisticsLower === 'hybrid') {
      points += 15
    } else if (logisticsLower === 'remote' && remote === true) {
      points += 15
    } else if (logisticsLower === 'on-site' && remote === false) {
      points += 15
    }

    const workStyleLower = workStyle.toLowerCase()
    const jobStyles = (workStyles ?? []).map(s => s.toLowerCase())

    for (const keywords of WORK_STYLE_KEYWORDS) {
      const userMentions = keywords.some(kw => workStyleLower.includes(kw))
      if (!userMentions) continue

      const jobMatches = jobStyles.some(js => keywords.some(kw => js.includes(kw)))
      if (jobMatches) {
        points += 15
        break
      }
    }

    return points
  }

  private scoreCulture(
    userAutonomy: number,
    userPace: number,
    jobAutonomy: number | null,
    jobPace: number | null,
  ): number {
    const autonomyPoints =
      jobAutonomy !== null
        ? 1 - Math.min(MAX_CULTURE_DISTANCE, Math.abs(userAutonomy - jobAutonomy)) / MAX_CULTURE_DISTANCE
        : 0.5
    const pacePoints =
      jobPace !== null
        ? 1 - Math.min(MAX_CULTURE_DISTANCE, Math.abs(userPace - jobPace)) / MAX_CULTURE_DISTANCE
        : 0.5
    return Math.round(((autonomyPoints + pacePoints) / 2) * 20)
  }
}
