import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app/app'

describe('Pricing Routes', () => {
  describe('GET /api/pricing', () => {
    it('should return pricing tiers ordered by price', async () => {
      const res = await request(app).get('/api/pricing').expect(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      if (res.body.data.length > 1) {
        for (let i = 1; i < res.body.data.length; i++) {
          expect(res.body.data[i].price).toBeGreaterThanOrEqual(res.body.data[i - 1].price)
        }
      }
    })

    it('should return tiers with required fields', async () => {
      const res = await request(app).get('/api/pricing').expect(200)
      for (const tier of res.body.data) {
        expect(tier.tier).toBeDefined()
        expect(tier.price).toBeDefined()
        expect(tier.period).toBeDefined()
        expect(tier.description).toBeDefined()
        expect(Array.isArray(tier.features)).toBe(true)
      }
    })
  })
})
