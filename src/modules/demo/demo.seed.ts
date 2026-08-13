import bcrypt from 'bcryptjs'
import { ApplicationStatus, UserRole, NotificationType } from '@prisma/client'
import type { Application, Job, Prisma, ScreeningQuestion, User } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { scoreApplication } from '../screening/screeningEngine'
import { DEMO_CANDIDATE_EMAILS, DEMO_COMPANY, isDemoCandidateEmail } from './demo.types'

const SALT_ROUNDS = 12
const PASSWORD = 'password123'
const DAY_MS = 24 * 60 * 60 * 1000

const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000)

interface DemoCandidateProfile {
  name: string
  headline: string
  bio: string
  skills: string[]
  phone: string
}

const DEMO_CANDIDATE_PROFILES: DemoCandidateProfile[] = [
  {
    name: 'Maya Chen',
    headline: 'Senior Product Designer',
    bio: 'Product designer with 8 years of experience shipping design systems and end-to-end product flows for SaaS teams.',
    skills: ['Figma', 'Design Systems', 'Prototyping', 'UX Research'],
    phone: '+1 415 555 0101',
  },
  {
    name: 'Lucas Silva',
    headline: 'Product Designer',
    bio: 'Product designer focused on UX research and interaction design for web products.',
    skills: ['Figma', 'UX Research', 'Interaction Design', 'Wireframing'],
    phone: '+1 415 555 0102',
  },
  {
    name: 'Priya Patel',
    headline: 'Frontend Engineer',
    bio: 'Frontend engineer who loves building accessible React interfaces and owning testing strategy.',
    skills: ['React', 'TypeScript', 'Testing', 'CSS'],
    phone: '+1 415 555 0103',
  },
  {
    name: 'Diego Fernández',
    headline: 'Senior Frontend Engineer',
    bio: 'Frontend engineer with a strong background in design systems and web performance.',
    skills: ['React', 'TypeScript', 'Design Systems', 'Testing'],
    phone: '+1 415 555 0104',
  },
  {
    name: 'Amina Hassan',
    headline: 'Data Analyst',
    bio: 'Data analyst turning messy datasets into dashboards and decisions with SQL and Python.',
    skills: ['SQL', 'Python', 'Dashboarding', 'Excel'],
    phone: '+1 415 555 0105',
  },
]

interface DemoJobDef {
  title: string
  category: string
  seniority: string
  salaryMin: number
  salaryMax: number
  tags: string[]
  requirements: string[]
  responsibilities: string[]
  description: string
  questions: { prompt: string; expectedKeywords: string[]; maxScore: number }[]
}

const DEMO_JOBS: DemoJobDef[] = [
  {
    title: 'Senior Product Designer',
    category: 'Design',
    seniority: 'Senior',
    salaryMin: 120000,
    salaryMax: 160000,
    tags: ['Product Design', 'Design Systems', 'Figma', 'UI'],
    requirements: ['Figma', 'Design Systems', 'Prototyping', 'UX Research'],
    responsibilities: [
      'Own product design end to end, from research to shipped UI',
      'Build and maintain the HireHub design system',
      'Run usability tests and synthesize findings',
      'Partner with engineering and product on roadmap features',
    ],
    description:
      'HireHub is looking for a Senior Product Designer to own the design of our hiring platform end to end. You will lead research, craft high-fidelity UI, and build the design system that keeps the product consistent and delightful.',
    questions: [
      { prompt: 'How many years of product design experience do you have?', expectedKeywords: ['years', 'design'], maxScore: 5 },
      { prompt: 'Describe your experience with design systems.', expectedKeywords: ['design', 'systems', 'figma'], maxScore: 5 },
      { prompt: 'Walk me through a portfolio project you are proud of.', expectedKeywords: ['portfolio'], maxScore: 5 },
    ],
  },
  {
    title: 'Frontend Engineer',
    category: 'Engineering',
    seniority: 'Mid',
    salaryMin: 110000,
    salaryMax: 150000,
    tags: ['React', 'TypeScript', 'Testing', 'Web'],
    requirements: ['React', 'TypeScript', 'Testing', 'CSS'],
    responsibilities: [
      'Build and ship customer-facing React features',
      'Write unit and component tests for new code',
      'Review pull requests and mentor junior engineers',
      'Improve frontend performance and accessibility',
    ],
    description:
      'HireHub is hiring a Frontend Engineer to build the React interfaces our customers use to hire and get hired. You will work across the dashboard, pipeline, and messaging surfaces with a small, senior team.',
    questions: [
      { prompt: 'How many years of React experience do you have?', expectedKeywords: ['react', 'years'], maxScore: 5 },
      { prompt: 'How do you approach testing UI components?', expectedKeywords: ['testing', 'test', 'component'], maxScore: 5 },
    ],
  },
  {
    title: 'Data Analyst',
    category: 'Data',
    seniority: 'Mid',
    salaryMin: 90000,
    salaryMax: 125000,
    tags: ['SQL', 'Python', 'Dashboarding', 'Analytics'],
    requirements: ['SQL', 'Python', 'Dashboarding', 'Communication'],
    responsibilities: [
      'Build and maintain dashboards for hiring analytics',
      'Write SQL and Python pipelines for reporting',
      'Partner with recruiting and product to define metrics',
      'Communicate insights to non-technical stakeholders',
    ],
    description:
      'HireHub is hiring a Data Analyst to own hiring analytics: pipelines, dashboards, and the metrics that guide product and recruiting decisions.',
    questions: [
      { prompt: 'Describe your experience with SQL.', expectedKeywords: ['sql'], maxScore: 5 },
      { prompt: 'Walk me through a dashboard you built.', expectedKeywords: ['dashboard'], maxScore: 5 },
    ],
  },
]

interface DemoAppDef {
  email: string
  jobTitle: string
  status: ApplicationStatus
  submittedDaysAgo: number
  coverLetter: string
  answers: { answerText: string }[]
  interviewData?: Prisma.InputJsonValue
  offerData?: Prisma.InputJsonValue
  preboardingData?: Prisma.InputJsonValue
  orientationData?: Prisma.InputJsonValue
}

const STAGE_PATH: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: [ApplicationStatus.APPLIED],
  SCREENING: [ApplicationStatus.APPLIED, ApplicationStatus.SCREENING],
  SHORTLIST: [ApplicationStatus.APPLIED, ApplicationStatus.SCREENING, ApplicationStatus.SHORTLIST],
  INTERVIEWING: [
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.SHORTLIST,
    ApplicationStatus.INTERVIEWING,
  ],
  OFFER: [
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.SHORTLIST,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.OFFER,
  ],
  HIRED: [
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.SHORTLIST,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.OFFER,
    ApplicationStatus.HIRED,
  ],
  REJECTED: [ApplicationStatus.APPLIED, ApplicationStatus.REJECTED],
  WITHDRAWN: [ApplicationStatus.APPLIED, ApplicationStatus.WITHDRAWN],
}

const isoDaysAgo = (n: number) => daysAgo(n).toISOString()

async function deleteScenarioData(employerId: string, alexId: string) {
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_CANDIDATE_EMAILS } },
    select: { id: true },
  })
  const userIds = [...demoUsers.map((u) => u.id), alexId]

  await prisma.conversation.deleteMany({
    where: { employerId, candidateId: { in: userIds } },
  })
  await prisma.application.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.job.deleteMany({ where: { employerId, company: DEMO_COMPANY } })
  await prisma.user.deleteMany({ where: { email: { in: DEMO_CANDIDATE_EMAILS } } })
}

async function createDemoUsers(passwordHash: string): Promise<User[]> {
  return Promise.all(
    DEMO_CANDIDATE_EMAILS.map((email, i) => {
      const profile = DEMO_CANDIDATE_PROFILES[i]
      const handle = email.split('@')[0]
      return prisma.user.create({
        data: {
          email,
          passwordHash,
          name: profile.name,
          role: 'SEEKER',
          headline: profile.headline,
          bio: profile.bio,
          skills: profile.skills,
          location: 'Remote',
          phone: profile.phone,
          onboardingCompleted: true,
          resumePath: `/uploads/resumes/${handle}.pdf`,
          resumeFileName: `${handle}.pdf`,
        },
      })
    }),
  )
}

async function createDemoJobs(
  employerId: string,
): Promise<Map<string, { job: Job; questions: ScreeningQuestion[] }>> {
  const jobs = new Map<string, { job: Job; questions: ScreeningQuestion[] }>()
  for (const def of DEMO_JOBS) {
    const job = await prisma.job.create({
      data: {
        title: def.title,
        company: DEMO_COMPANY,
        location: 'Remote',
        remote: true,
        salaryMin: def.salaryMin,
        salaryMax: def.salaryMax,
        currency: 'USD',
        tags: def.tags,
        category: def.category,
        seniority: def.seniority,
        description: def.description,
        requirements: def.requirements,
        responsibilities: def.responsibilities,
        employerId,
        expiresAt: daysAgo(-14),
        screeningQuestions: {
          create: def.questions.map((q, i) => ({
            prompt: q.prompt,
            expectedKeywords: q.expectedKeywords,
            maxScore: q.maxScore,
            order: i + 1,
          })),
        },
      },
      include: { screeningQuestions: { orderBy: { order: 'asc' } } },
    })
    jobs.set(def.title, { job, questions: job.screeningQuestions })
  }
  return jobs
}

async function createApplications(
  employerId: string,
  usersByEmail: Map<string, User>,
  jobs: Map<string, { job: Job; questions: ScreeningQuestion[] }>,
  c1ConversationId: string,
  alexConversationId: string,
): Promise<Application[]> {
  const c1Email = DEMO_CANDIDATE_EMAILS[0]

  const interviewQuestions = (questions: ScreeningQuestion[]) =>
    questions.map((q) => ({ id: q.id, prompt: q.prompt }))

  const defs: DemoAppDef[] = [
    {
      email: c1Email,
      jobTitle: 'Senior Product Designer',
      status: ApplicationStatus.INTERVIEWING,
      submittedDaysAgo: 4,
      coverLetter:
        'I have 8 years of product design experience, including building design systems in Figma and leading research for SaaS products. My portfolio shows products I took from concept to shipped UI.',
      answers: [
        { answerText: 'I have 8 years of product design experience across SaaS and enterprise products.' },
        { answerText: 'I built and maintained design systems in Figma for two companies.' },
        { answerText: 'My portfolio highlights a full product redesign I led from research to shipped UI.' },
      ],
      interviewData: {
        interviewType: 'website-chat',
        interviewDate: '2026-08-15',
        interviewTime: '10:00',
        interviewerName: 'Jordan Lee',
        interviewerTitle: 'Head of Product Design',
        scheduledAt: isoDaysAgo(2),
        conversationId: c1ConversationId,
        questions: interviewQuestions(jobs.get('Senior Product Designer')!.questions),
      },
    },
    {
      email: DEMO_CANDIDATE_EMAILS[1],
      jobTitle: 'Senior Product Designer',
      status: ApplicationStatus.SCREENING,
      submittedDaysAgo: 3,
      coverLetter:
        'I am a product designer with experience in design systems, Figma, and UX research for web products.',
      answers: [
        { answerText: 'I have been designing products for four years, mostly for web apps.' },
        { answerText: 'I have contributed to design systems and collaborated closely with engineering.' },
        { answerText: 'My portfolio includes several products where I owned research and visual design.' },
      ],
    },
    {
      email: DEMO_CANDIDATE_EMAILS[2],
      jobTitle: 'Frontend Engineer',
      status: ApplicationStatus.SHORTLIST,
      submittedDaysAgo: 5,
      coverLetter:
        'I build accessible React applications with TypeScript and write tests for everything I ship.',
      answers: [
        { answerText: 'I have been working with React for four years.' },
        { answerText: 'I write unit tests with Vitest and component tests for each UI piece.' },
      ],
    },
    {
      email: DEMO_CANDIDATE_EMAILS[3],
      jobTitle: 'Frontend Engineer',
      status: ApplicationStatus.OFFER,
      submittedDaysAgo: 12,
      coverLetter:
        'Senior frontend engineer experienced in React, TypeScript, design systems, and performance.',
      answers: [
        { answerText: 'Five years of React experience building design systems and complex dashboards.' },
        { answerText: 'I approach testing with a component-first strategy, covering states and accessibility.' },
      ],
      offerData: {
        jobTitle: 'Frontend Engineer',
        employmentType: 'full-time',
        startDate: '2026-09-01',
        hourlyRate: 62,
        currency: 'USD',
        schedule: 'Mon-Fri, 9am-5pm',
        managerName: 'Jordan Lee',
        managerTitle: 'Head of Engineering',
        responsibilities: [
          'Build customer-facing React features',
          'Review code and mentor junior engineers',
          'Own frontend testing strategy',
        ],
        contingencies: ['Background check', 'Reference check'],
        expirationDate: '2026-08-30',
        accepted: true,
        acceptedAt: isoDaysAgo(3),
      },
    },
    {
      email: DEMO_CANDIDATE_EMAILS[4],
      jobTitle: 'Data Analyst',
      status: ApplicationStatus.HIRED,
      submittedDaysAgo: 16,
      coverLetter:
        'Data analyst with strong SQL and Python skills who has built dashboards that drive decisions.',
      answers: [
        { answerText: 'I write complex SQL every day, including joins, window functions, and reporting queries.' },
        { answerText: 'I built a hiring dashboard that reduced reporting time from hours to minutes.' },
      ],
      preboardingData: [
        { id: 'doc-1', label: 'Sign offer letter', category: 'Documents', completed: true, completedAt: isoDaysAgo(3) },
        { id: 'doc-2', label: 'Upload government ID', category: 'Documents', completed: true, completedAt: isoDaysAgo(2) },
        { id: 'it-1', label: 'Laptop setup', category: 'IT Setup', completed: true, completedAt: isoDaysAgo(1) },
        { id: 'it-2', label: 'Access to repos and dashboards', category: 'IT Setup', completed: false },
        { id: 'ben-1', label: 'Enroll in benefits', category: 'Benefits', completed: false },
        { id: 'tr-1', label: 'Security onboarding training', category: 'Training', completed: false },
      ],
      orientationData: {
        date: '2026-08-22',
        time: '10:00 AM',
        location: 'Remote - Google Meet',
        agenda: ['Team introductions', 'Product walkthrough', 'IT and security setup', 'Q&A'],
        notes: 'Join from the invite link sent to your inbox.',
      },
    },
    {
      email: 'alex@example.com',
      jobTitle: 'Data Analyst',
      status: ApplicationStatus.INTERVIEWING,
      submittedDaysAgo: 6,
      coverLetter:
        'I bring experience in SQL, Python, and dashboarding from my analytics roles.',
      answers: [
        { answerText: 'I have used SQL daily for the past three years in analytics roles.' },
        { answerText: 'I built a dashboard in Looker that leadership reviews weekly.' },
      ],
      interviewData: {
        interviewType: 'phone',
        interviewDate: '2026-08-18',
        interviewTime: '14:30',
        interviewerName: 'Sarah Kim',
        interviewerTitle: 'Head of Data',
        notes: 'Brief chat about your dashboard work.',
        scheduledAt: isoDaysAgo(2),
        conversationId: alexConversationId,
      },
    },
    {
      email: 'alex@example.com',
      jobTitle: 'Frontend Engineer',
      status: ApplicationStatus.APPLIED,
      submittedDaysAgo: 1,
      coverLetter:
        'I am a full-stack developer comfortable with React and TypeScript looking to grow on a strong team.',
      answers: [
        { answerText: 'Two years of React experience building internal tools.' },
        { answerText: 'I write tests for the most important user flows.' },
      ],
    },
    {
      email: DEMO_CANDIDATE_EMAILS[2],
      jobTitle: 'Senior Product Designer',
      status: ApplicationStatus.REJECTED,
      submittedDaysAgo: 25,
      coverLetter:
        'I am applying for the product designer role and have experience with Figma and prototyping.',
      answers: [],
    },
    {
      email: DEMO_CANDIDATE_EMAILS[4],
      jobTitle: 'Data Analyst',
      status: ApplicationStatus.WITHDRAWN,
      submittedDaysAgo: 22,
      coverLetter: 'Applying for the data analyst role.',
      answers: [],
    },
  ]

  const created: Application[] = []
  for (const def of defs) {
    const candidate = usersByEmail.get(def.email)!
    const { job, questions } = jobs.get(def.jobTitle)!
    const submittedAt = daysAgo(def.submittedDaysAgo)

    const screening = scoreApplication({
      requirements: job.requirements,
      tags: job.tags,
      coverLetter: def.coverLetter,
      questions: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        expectedKeywords: q.expectedKeywords,
        maxScore: q.maxScore,
      })),
      answers: def.answers.map((a, i) => ({ questionId: questions[i].id, answerText: a.answerText })),
    })

    const answersCreate = screening.answers.map((a, i) => ({
      questionId: a.questionId,
      answerText: def.answers[i]?.answerText ?? '',
      score: a.score,
      matchedKeywords: a.matchedKeywords,
    }))

    const path = STAGE_PATH[def.status]
    const timeline = path.map((status, i) => ({
      fromStatus: i === 0 ? null : path[i - 1],
      toStatus: status,
      actorRole: i === 0 ? UserRole.SEEKER : UserRole.EMPLOYER,
      changedByUserId: i === 0 ? candidate.id : employerId,
      createdAt: new Date(submittedAt.getTime() + i * DAY_MS),
    }))

    const application = await prisma.application.create({
      data: {
        job: { connect: { id: job.id } },
        user: { connect: { id: candidate.id } },
        applicantName: candidate.name,
        applicantEmail: candidate.email,
        applicantPhone: candidate.phone,
        coverLetter: def.coverLetter,
        resumePath: `/uploads/resumes/${candidate.email.split('@')[0]}.pdf`,
        resumeFileName: `${candidate.email.split('@')[0]}.pdf`,
        status: def.status,
        submittedAt,
        interviewData: def.interviewData,
        offerData: def.offerData,
        preboardingData: def.preboardingData,
        orientationData: def.orientationData,
        screeningResult: { create: { score: screening.score, maxPossible: screening.maxPossible } },
        screeningAnswers: { create: answersCreate },
        timeline: { create: timeline },
      },
    })
    created.push(application)
  }
  return created
}

async function createNotifications(
  employerId: string,
  alexId: string,
  c1Id: string,
  c2Id: string,
  c4Id: string,
) {
  const notifications = [
    {
      userId: employerId,
      type: NotificationType.APPLICATION_STATUS,
      title: 'New application received',
      body: 'Maya Chen applied for Senior Product Designer.',
      data: { status: 'APPLIED' },
      createdAt: daysAgo(3),
    },
    {
      userId: employerId,
      type: NotificationType.APPLICATION_STATUS,
      title: 'Candidate moved to interview',
      body: 'Maya Chen is now INTERVIEWING for Senior Product Designer.',
      data: { status: 'INTERVIEWING' },
      createdAt: daysAgo(2),
    },
    {
      userId: c2Id,
      type: NotificationType.APPLICATION_STATUS,
      title: 'Application status updated',
      body: 'Your application for Senior Product Designer is now SCREENING.',
      data: { status: 'SCREENING' },
      createdAt: daysAgo(2),
    },
    {
      userId: c4Id,
      type: NotificationType.APPLICATION_STATUS,
      title: 'You received an offer',
      body: 'Your application for Frontend Engineer received an offer.',
      data: { status: 'OFFER' },
      createdAt: daysAgo(1),
    },
    {
      userId: alexId,
      type: NotificationType.APPLICATION_STATUS,
      title: 'Interview scheduled',
      body: 'Your phone interview for Data Analyst has been scheduled.',
      data: { status: 'INTERVIEWING' },
      createdAt: hoursAgo(18),
    },
  ]
  for (const n of notifications) {
    await prisma.notification.create({ data: n as Prisma.NotificationCreateInput })
  }
}

async function main() {
  const employer = await prisma.user.findUnique({ where: { email: 'employer@hirehub.community' } })
  const alex = await prisma.user.findUnique({ where: { email: 'alex@example.com' } })
  if (!employer || employer.role !== 'EMPLOYER') {
    console.error('Employer seed account missing. Run `npm run db:seed` first.')
    process.exit(1)
  }
  if (!alex) {
    console.error('Seeker seed account missing. Run `npm run db:seed` first.')
    process.exit(1)
  }

  console.log('🌱 Seeding demo hiring scenario...')

  await deleteScenarioData(employer.id, alex.id)

  await prisma.user.update({
    where: { id: employer.id },
    data: { onboardingCompleted: true },
  })
  await prisma.user.update({
    where: { id: alex.id },
    data: { onboardingCompleted: true },
  })

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS)
  const demoUsers = await createDemoUsers(passwordHash)
  const usersByEmail = new Map(demoUsers.map((u) => [u.email, u]))
  usersByEmail.set(alex.email, alex)

  const jobs = await createDemoJobs(employer.id)

  const c1 = usersByEmail.get(DEMO_CANDIDATE_EMAILS[0])!
  const job1 = jobs.get('Senior Product Designer')!
  const c1Conversation = await prisma.conversation.create({
    data: { employerId: employer.id, candidateId: c1.id, jobId: job1.job.id },
  })
  const job3 = jobs.get('Data Analyst')!
  const alexConversation = await prisma.conversation.create({
    data: { employerId: employer.id, candidateId: alex.id, jobId: job3.job.id },
  })

  const interviewMessages: { conversationId: string; senderId: string; content: string; createdAt: Date }[] = [
    {
      conversationId: c1Conversation.id,
      senderId: employer.id,
      content: `Welcome to your HireHub interview for Senior Product Designer! Please reply to the questions below to get started.`,
      createdAt: daysAgo(2),
    },
  ]
  job1.questions.forEach((q, i) => {
    const base = daysAgo(2).getTime() + (i + 1) * 2 * 60 * 60 * 1000
    interviewMessages.push({ conversationId: c1Conversation.id, senderId: employer.id, content: `Q: ${q.prompt}`, createdAt: new Date(base) })
    interviewMessages.push({ conversationId: c1Conversation.id, senderId: c1.id, content: DEMO_CANDIDATE_ANSWERS[i], createdAt: new Date(base + 45 * 60 * 1000) })
  })
  interviewMessages.push({ conversationId: c1Conversation.id, senderId: employer.id, content: 'Thanks - could you share your availability for a follow-up call?', createdAt: hoursAgo(5) })
  interviewMessages.push({ conversationId: c1Conversation.id, senderId: c1.id, content: 'Absolutely, I am free most mornings next week.', createdAt: hoursAgo(2) })
  await prisma.message.createMany({ data: interviewMessages })

  await prisma.message.createMany({
    data: [
      {
        conversationId: alexConversation.id,
        senderId: employer.id,
        content: "Hi Alex, thanks for your interest in the Data Analyst role. I'd like to schedule a quick phone interview.",
        createdAt: daysAgo(1),
      },
      {
        conversationId: alexConversation.id,
        senderId: alex.id,
        content: 'Hi, great to hear from you! I am available Wednesday or Thursday afternoon.',
        createdAt: hoursAgo(20),
      },
    ],
  })

  await createApplications(employer.id, usersByEmail, jobs, c1Conversation.id, alexConversation.id)

  await createNotifications(employer.id, alex.id, c1.id, usersByEmail.get(DEMO_CANDIDATE_EMAILS[1])!.id, usersByEmail.get(DEMO_CANDIDATE_EMAILS[3])!.id)

  console.log('Demo scenario ready:')
  console.log(`  Employer:         employer@hirehub.community / ${PASSWORD}`)
  console.log(`  Seeker:           alex@example.com / ${PASSWORD}`)
  console.log(`  Demo candidates:  ${DEMO_CANDIDATE_EMAILS.join(', ')}`)
  console.log(`  Jobs:             ${DEMO_JOBS.map((j) => j.title).join(', ')}`)
  console.log('  Tip: run the server with DEMO_BOT_ENABLED=true to see candidate1 reply live.')
}

const DEMO_CANDIDATE_ANSWERS = [
  'I have 8 years of product design experience across SaaS and enterprise products.',
  'I built and maintained design systems in Figma for two companies.',
  'My portfolio highlights a full product redesign I led from research to shipped UI.',
]

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo seed failed:', error)
    process.exit(1)
  })
