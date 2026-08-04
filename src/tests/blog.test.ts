import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app/app'
import { prisma } from '../lib/prisma'

let testPostSlug = ''

describe('Blog Routes', () => {
  beforeAll(async () => {
    const post = await prisma.blogPost.findFirst()
    if (post) testPostSlug = post.slug
  })

  describe('GET /api/blog-posts', () => {
    it('should return paginated blog posts', async () => {
      const res = await request(app).get('/api/blog-posts').expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('should return posts with a nested author object', async () => {
      const res = await request(app).get('/api/blog-posts').expect(200)
      expect(res.body.success).toBe(true)
      if (res.body.data.length === 0) return
      const post = res.body.data[0]
      expect(post.author).toBeDefined()
      expect(typeof post.author.name).toBe('string')
      expect(post.authorName).toBeUndefined()
    })

    it('should support category filter', async () => {
      const res = await request(app)
        .get('/api/blog-posts?category=Hiring Tips')
        .expect(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/blog-posts/:slug', () => {
    it('should return a blog post by slug', async () => {
      if (!testPostSlug) return
      const res = await request(app)
        .get(`/api/blog-posts/${testPostSlug}`)
        .expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.slug).toBe(testPostSlug)
    })

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app)
        .get('/api/blog-posts/this-slug-does-not-exist-xyz')
        .expect(404)
      expect(res.body.success).toBe(false)
    })
  })
})
