import type { Request, Response } from 'express'
import { success } from '../../lib/response'
import { AdminService } from './admin.service'

const adminService = new AdminService()

export async function listUsers(req: Request, res: Response) {
  const users = await adminService.listUsers()
  success(res, users)
}

export async function updateUserRole(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  const { role } = req.body
  const updated = await adminService.updateUserRole(id, role)
  success(res, updated)
}

export async function listJobs(req: Request, res: Response) {
  const jobs = await adminService.listJobs()
  success(res, jobs)
}

export async function listApplications(req: Request, res: Response) {
  const applications = await adminService.listApplications()
  success(res, applications)
}

export async function listEmployers(req: Request, res: Response) {
  const employers = await adminService.listEmployers()
  success(res, employers)
}

export async function deleteJob(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  await adminService.deleteJob(id)
  success(res, { message: 'Job deleted' })
}

export async function listBlogPosts(req: Request, res: Response) {
  const posts = await adminService.listBlogPosts()
  success(res, posts)
}

export async function deleteBlogPost(req: Request, res: Response) {
  const { id } = req.params as { id: string }
  await adminService.deleteBlogPost(id)
  success(res, { message: 'Blog post deleted' })
}
