import type { Request, Response } from 'express'
import { addClient } from '../../services/sse'

export function streamNotifications(req: Request, res: Response) {
  const added = addClient(req.user!.userId, res)
  if (!added) {
    res.status(429).json({ error: 'Too many connections' })
    return
  }

  const keepalive = setInterval(() => {
    res.write(':keepalive\n\n')
  }, 30000)

  req.on('close', () => {
    clearInterval(keepalive)
  })
}
