import type { Response } from 'express'

const clients = new Map<string, Set<Response>>()
const MAX_CONNECTIONS_PER_USER = 5

function getClientCount(userId: string): number {
  return clients.get(userId)?.size ?? 0
}

export function addClient(userId: string, res: Response): boolean {
  if (getClientCount(userId) >= MAX_CONNECTIONS_PER_USER) {
    return false
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(':\n\n')

  if (!clients.has(userId)) {
    clients.set(userId, new Set())
  }
  clients.get(userId)!.add(res)

  res.on('close', () => {
    const set = clients.get(userId)
    if (set) {
      set.delete(res)
      if (set.size === 0) clients.delete(userId)
    }
  })

  return true
}

export function removeClient(userId: string, res: Response): void {
  const set = clients.get(userId)
  if (set) {
    set.delete(res)
    if (set.size === 0) clients.delete(userId)
  }
}

export function sendToUser(userId: string, event: string, data: unknown): void {
  const set = clients.get(userId)
  if (set) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of set) {
      res.write(payload)
    }
  }
}

export function getConnectedUserCount(): number {
  return clients.size
}
