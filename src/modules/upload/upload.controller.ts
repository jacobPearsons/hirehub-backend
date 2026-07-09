import type { Request, Response, NextFunction } from 'express'
import { uploadResume } from '../../services/upload'
import { success } from '../../lib/response'
import { ValidationError } from '../../middleware/error-handler'

export function uploadResumeHandler(req: Request, res: Response, next: NextFunction) {
  uploadResume(req, res, (err) => {
    if (err) return next(err)

    if (!req.file) {
      return next(new ValidationError('No file provided'))
    }

    success(res, {
      resumePath: `/uploads/resumes/${req.file.filename}`,
      resumeFileName: req.file.originalname,
    })
  })
}
