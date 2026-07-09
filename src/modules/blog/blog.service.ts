import { BlogRepository } from './blog.repository'
import { NotFoundError } from '../../middleware/error-handler'

export class BlogService {
  private repo = new BlogRepository()

  async list(params: { category?: string; cursor?: string; take?: number }) {
    const take = params.take ?? 6
    const where: any = {}
    if (params.category) where.category = params.category

    const posts = await this.repo.findMany({ where, take, cursor: params.cursor })
    const total = await this.repo.count(where)

    const hasMore = posts.length > take
    const items = hasMore ? posts.slice(0, take) : posts
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { posts: items, pagination: { total, cursor: nextCursor ?? null } }
  }

  async getBySlug(slug: string) {
    const post = await this.repo.findBySlug(slug)
    if (!post) throw new NotFoundError('Blog post')
    return post
  }
}
