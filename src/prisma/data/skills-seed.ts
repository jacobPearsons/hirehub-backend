import { Prisma, SkillCategory } from '@prisma/client'

export const skillsData: Prisma.SkillCreateManyInput[] = [
  { name: 'React', slug: 'react', category: SkillCategory.ENGINEERING },
  { name: 'TypeScript', slug: 'typescript', category: SkillCategory.ENGINEERING },
  { name: 'Node.js', slug: 'nodejs', category: SkillCategory.ENGINEERING },
  { name: 'Python', slug: 'python', category: SkillCategory.ENGINEERING },
  { name: 'Go', slug: 'go', category: SkillCategory.ENGINEERING },
  { name: 'Rust', slug: 'rust', category: SkillCategory.ENGINEERING },
  { name: 'GraphQL', slug: 'graphql', category: SkillCategory.ENGINEERING },
  { name: 'Design Systems', slug: 'design-systems', category: SkillCategory.DESIGN },
  { name: 'Figma', slug: 'figma', category: SkillCategory.DESIGN },
  { name: 'Brand Design', slug: 'brand-design', category: SkillCategory.DESIGN },
  { name: 'Motion Design', slug: 'motion-design', category: SkillCategory.DESIGN },
  { name: 'Product Strategy', slug: 'product-strategy', category: SkillCategory.PRODUCT },
  { name: 'User Research', slug: 'user-research', category: SkillCategory.PRODUCT },
  { name: 'Growth Marketing', slug: 'growth-marketing', category: SkillCategory.MARKETING },
  { name: 'SEO & Content', slug: 'seo-content', category: SkillCategory.MARKETING },
  { name: 'ML Engineering', slug: 'ml-engineering', category: SkillCategory.DATA_AI },
  { name: 'Data Engineering', slug: 'data-engineering', category: SkillCategory.DATA_AI },
  { name: 'DevOps', slug: 'devops', category: SkillCategory.DEVOPS_SECURITY },
  { name: 'Security', slug: 'security', category: SkillCategory.DEVOPS_SECURITY },
  { name: 'Developer Education', slug: 'developer-education', category: SkillCategory.DEVOPS_SECURITY },
]
