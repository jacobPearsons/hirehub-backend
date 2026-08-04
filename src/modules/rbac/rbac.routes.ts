import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { z } from 'zod'
import * as rbacController from './rbac.controller'

const router = Router()

const createRoleSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  capabilities: z.array(z.string()).min(1),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  capabilities: z.array(z.string()).optional(),
})

const createBindingSchema = z.object({
  userId: z.string(),
  contextType: z.enum(['global', 'project']).default('global'),
  contextId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

router.get('/roles', requireAuth, requireRole('ADMIN'), rbacController.listRoles)
router.get('/roles/bindings', requireAuth, requireRole('ADMIN'), rbacController.listBindings)
router.get('/roles/:id', requireAuth, requireRole('ADMIN'), rbacController.getRoleById)
router.post('/roles', requireAuth, requireRole('ADMIN'), validate(createRoleSchema), rbacController.createRole)
router.put('/roles/:id', requireAuth, requireRole('ADMIN'), validate(updateRoleSchema), rbacController.updateRole)
router.delete('/roles/:id', requireAuth, requireRole('ADMIN'), rbacController.deleteRole)
router.post('/roles/:id/bindings', requireAuth, requireRole('ADMIN'), validate(createBindingSchema), rbacController.createBinding)
router.delete('/roles/bindings/:bindingId', requireAuth, requireRole('ADMIN'), rbacController.deleteBinding)

export default router
