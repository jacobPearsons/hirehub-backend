import { describe, it, expect } from 'vitest'
import type { BlogPost } from '@prisma/client'
import { toBlogPostDto } from './blog.dto'

const flatPost: BlogPost = {
  id: '1',
  slug: 'us-labor-market-2026-outlook',
  title: 'US Labor Market 2026 Outlook: A Cautious Road Ahead',
  excerpt: 'The US labor market enters 2026 in a cautious phase.',
  content: 'Paragraph one.\n\nParagraph two.',
  image: '/blog-cover-us-labor-2026.png',
  category: 'Industry News',
  authorName: 'HireHub Editorial',
  authorAvatar: 'https://i.pravatar.cc/150?u=hirehub-editorial',
  authorRole: 'HireHub Editorial Team',
  date: new Date('2026-08-04'),
  readTime: 4,
  featured: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('toBlogPostDto', () => {
  it('nests author fields into an author object', () => {
    const dto = toBlogPostDto(flatPost)
    expect(dto.author).toEqual({
      name: 'HireHub Editorial',
      avatar: 'https://i.pravatar.cc/150?u=hirehub-editorial',
      role: 'HireHub Editorial Team',
    })
  })

  it('drops the flat author fields from the payload', () => {
    const dto = toBlogPostDto(flatPost) as unknown as Record<string, unknown>
    expect(dto.authorName).toBeUndefined()
    expect(dto.authorAvatar).toBeUndefined()
    expect(dto.authorRole).toBeUndefined()
  })

  it('preserves all other post fields', () => {
    const dto = toBlogPostDto(flatPost)
    expect(dto.slug).toBe('us-labor-market-2026-outlook')
    expect(dto.image).toBe('/blog-cover-us-labor-2026.png')
    expect(dto.category).toBe('Industry News')
    expect(dto.featured).toBe(true)
    expect(dto.date).toBeInstanceOf(Date)
  })
})
