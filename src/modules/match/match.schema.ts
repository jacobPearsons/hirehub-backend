import { z } from 'zod'

export const matchBodySchema = z.object({
  skills: z.array(z.string()).min(1).max(20),
  workStyle: z.string().min(1).max(200),
  cultureAutonomy: z.number().int().min(1).max(5),
  culturePace: z.number().int().min(1).max(5),
  trajectory: z.string().min(1).max(200),
  logistics: z.string().min(1).max(200),
})

export type MatchBody = z.infer<typeof matchBodySchema>
