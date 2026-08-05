import { describe, it, expect, vi } from 'vitest'
import { deliver, SENDER, LOGO_CID } from '../services/email'

function fakeClient() {
  const send = vi.fn().mockResolvedValue({ error: null })
  const client = { emails: { send } }
  return { client, send }
}

describe('deliver', () => {
  it('sends the branded payload with the embedded logo attachment', async () => {
    const { client, send } = fakeClient()
    await deliver('alice@example.com', 'Subject line', '<p>Body</p>', client)
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.from).toBe(SENDER)
    expect(payload.to).toBe('alice@example.com')
    expect(payload.subject).toBe('Subject line')
    expect(payload.html).toBe('<p>Body</p>')
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments[0].filename).toBe('logo-mark.png')
    expect(payload.attachments[0].content_id).toBe(LOGO_CID)
    expect(Buffer.isBuffer(payload.attachments[0].content)).toBe(true)
    expect(payload.attachments[0].content.length).toBeGreaterThan(0)
  })

  it('skips sending when no client is provided', async () => {
    await expect(deliver('alice@example.com', 'Subject', '<p>Body</p>', null)).resolves.toBeUndefined()
  })

  it('does not throw when the send reports an error', async () => {
    const send = vi.fn().mockResolvedValue({ error: new Error('boom') })
    await expect(deliver('alice@example.com', 'Subject', '<p>Body</p>', { emails: { send } })).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
  })
})
