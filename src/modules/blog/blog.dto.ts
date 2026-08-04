import type { BlogPost } from '@prisma/client'

export interface BlogPostAuthor {
  name: string
  avatar: string | null
  role: string | null
}

export interface BlogPostDto {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  image: string | null
  category: string
  author: BlogPostAuthor
  date: Date
  readTime: number
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

export function toBlogPostDto(post: BlogPost): BlogPostDto {
  const { authorName, authorAvatar, authorRole, ...rest } = post
  return {
    ...rest,
    author: { name: authorName, avatar: authorAvatar, role: authorRole },
  }
}
