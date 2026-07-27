import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export class RbacRepository {
  async findManyRoles(params?: { where?: Prisma.RoleWhereInput }) {
    return prisma.role.findMany({
      where: params?.where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findRoleById(id: string) {
    return prisma.role.findUnique({ where: { id } })
  }

  async createRole(data: Prisma.RoleCreateInput) {
    return prisma.role.create({ data })
  }

  async updateRole(id: string, data: Prisma.RoleUpdateInput) {
    return prisma.role.update({ where: { id }, data })
  }

  async deleteRole(id: string) {
    return prisma.role.delete({ where: { id } })
  }

  async findManyBindings(params?: { where?: Prisma.RoleBindingWhereInput }) {
    return prisma.roleBinding.findMany({
      where: params?.where,
      include: { role: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { grantedAt: 'desc' },
    })
  }

  async findBindingById(id: string) {
    return prisma.roleBinding.findUnique({ where: { id } })
  }

  async createBinding(data: Prisma.RoleBindingCreateInput) {
    return prisma.roleBinding.create({ data })
  }

  async deleteBinding(id: string) {
    return prisma.roleBinding.delete({ where: { id } })
  }
}
