import type { Request, Response, NextFunction } from 'express'

const SANITIZE_FIELDS = new Set([
  'coverLetter',
  'bio',
  'description',
  'name',
  'companyName',
  'title',
  'requirements',
  'responsibilities',
])

const DANGEROUS_PATTERNS: RegExp[] = [
  /<script[\s>]/gi,
  /<\/script>/gi,
  /<iframe[\s>]/gi,
  /<\/iframe>/gi,
  /<object[\s>]/gi,
  /<\/object>/gi,
  /<embed[\s>]/gi,
  /<applet[\s>]/gi,
  /<\/applet>/gi,
  /<form[\s>]/gi,
  /<\/form>/gi,
  /on\w+\s*=/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
]

function sanitizeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  let sanitized = value
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  return sanitized
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (SANITIZE_FIELDS.has(key)) {
      obj[key] = sanitizeValue(obj[key])
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      walkAndSanitize(obj[key])
    }
  }
}

function walkAndSanitize(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        walkAndSanitize(item)
      }
    }
  } else if (typeof value === 'object' && value !== null) {
    sanitizeObject(value as Record<string, unknown>)
  }
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    walkAndSanitize(req.body)
  }
  next()
}
