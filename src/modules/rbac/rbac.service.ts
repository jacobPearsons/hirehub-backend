import { Prisma } from '@prisma/client'
import { RbacRepository } from './rbac.repository'
import { NotFoundError } from '../../middleware/error-handler'

export class RbacService {
  private repo = new RbacRepository()

  async listRoles() {
    return this.repo.findManyRoles()
  }

  async getRoleById(id: string) {
    const role = await this.repo.findRoleById(id)
    if (!role) throw new NotFoundError('Role')
    return role
  }

  async createRole(data: { id: string; name: string; description?: string; capabilities: string[] }) {
    return this.repo.createRole({
      id: data.id,
      name: data.name,
      description: data.description ?? '',
      capabilities: data.capabilities,
    })
  }

  async updateRole(id: string, data: Prisma.RoleUpdateInput) {
    const role = await this.repo.findRoleById(id)
    if (!role) throw new NotFoundError('Role')
    return this.repo.updateRole(id, data)
  }

  async deleteRole(id: string) {
    const role = await this.repo.findRoleById(id)
    if (!role) throw new NotFoundError('Role')
    await this.repo.deleteRole(id)
  }

  async createBinding(data: {
    roleId: string
    userId: string
    contextType?: string
    contextId?: string
    expiresAt?: string
    grantedBy?: string
  }) {
    await this.getRoleById(data.roleId)
    return this.repo.createBinding({
      role: { connect: { id: data.roleId } },
      user: { connect: { id: data.userId } },
      contextType: data.contextType ?? 'global',
      contextId: data.contextId ?? null,
      grantedBy: data.grantedBy ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })
  }

  async deleteBinding(id: string) {
    const binding = await this.repo.findBindingById(id)
    if (!binding) throw new NotFoundError('Role binding')
    await this.repo.deleteBinding(id)
  }

  async listBindings(params?: { roleId?: string; userId?: string }) {
    const where: Prisma.RoleBindingWhereInput = {}
    if (params?.roleId) where.roleId = params.roleId
    if (params?.userId) where.userId = params.userId
    return this.repo.findManyBindings({ where })
  }
}
