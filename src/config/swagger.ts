import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HireHub API',
      version: '1.0.0',
      description: 'API for the HireHub job platform',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['SEEKER', 'EMPLOYER', 'ADMIN'] },
            companyName: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            location: { type: 'string' },
            description: { type: 'string' },
            requirements: { type: 'string' },
            salary: { type: 'string', nullable: true },
            type: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'string' },
            postedDate: { type: 'string', format: 'date-time' },
            employerId: { type: 'string' },
          },
        },
        Application: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            applicantName: { type: 'string' },
            applicantEmail: { type: 'string' },
            status: { type: 'string', enum: ['APPLIED', 'REVIEWING', 'INTERVIEWING', 'REJECTED', 'OFFER'] },
            jobId: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        BlogPost: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            excerpt: { type: 'string' },
            content: { type: 'string' },
            author: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            slug: { type: 'string' },
            image: { type: 'string' },
            tags: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: { '200': { description: 'OK' }, '503': { description: 'Database unavailable' } },
        },
      },
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                password: { type: 'string', minLength: 8 },
                role: { type: 'string', enum: ['SEEKER', 'EMPLOYER'] },
                companyName: { type: 'string' },
              },
            }}},
          },
          responses: {
            '201': { description: 'User registered' },
            '409': { description: 'Email already registered' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string' },
                password: { type: 'string' },
              },
            }}},
          },
          responses: {
            '200': { description: 'Login successful' },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Logged out' } },
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: { refreshToken: { type: 'string' } },
            }}},
          },
          responses: { '200': { description: 'Token refreshed' } },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Current user' }, '401': { description: 'Unauthorized' } },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string' } },
            }}},
          },
          responses: { '200': { description: 'Reset email sent if account exists' } },
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['token', 'password'],
              properties: {
                token: { type: 'string' },
                password: { type: 'string', minLength: 8 },
              },
            }}},
          },
          responses: { '200': { description: 'Password reset' } },
        },
      },
      '/api/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'List jobs (with search & pagination)',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          ],
          responses: { '200': { description: 'Job list' } },
        },
        post: {
          tags: ['Jobs'],
          summary: 'Create a job',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['title', 'company', 'location', 'description', 'type', 'category'],
              properties: {
                title: { type: 'string' },
                company: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
                requirements: { type: 'string' },
                salary: { type: 'string' },
                type: { type: 'string' },
                category: { type: 'string' },
                tags: { type: 'string' },
              },
            }}},
          },
          responses: { '201': { description: 'Job created' } },
        },
      },
      '/api/jobs/{id}': {
        get: {
          tags: ['Jobs'],
          summary: 'Get job by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job details' }, '404': { description: 'Not found' } },
        },
        put: {
          tags: ['Jobs'],
          summary: 'Update job',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job updated' }, '404': { description: 'Not found' } },
        },
        delete: {
          tags: ['Jobs'],
          summary: 'Delete job',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job deleted' }, '404': { description: 'Not found' } },
        },
      },
      '/api/jobs/saved': {
        get: {
          tags: ['Jobs'],
          summary: 'Get saved jobs for current user',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Saved jobs' } },
        },
      },
      '/api/jobs/{id}/save': {
        post: {
          tags: ['Jobs'],
          summary: 'Save a job',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job saved' } },
        },
        delete: {
          tags: ['Jobs'],
          summary: 'Unsave a job',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job unsaved' } },
        },
      },
      '/api/applications': {
        get: {
          tags: ['Applications'],
          summary: 'List applications (seeker: own, employer: by jobId)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'jobId', in: 'query', schema: { type: 'string' }, description: 'Required for employers' }],
          responses: { '200': { description: 'Application list' } },
        },
        post: {
          tags: ['Applications'],
          summary: 'Submit an application',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['jobId'],
              properties: {
                jobId: { type: 'string' },
                applicantName: { type: 'string' },
                applicantEmail: { type: 'string' },
                coverLetter: { type: 'string' },
              },
            }}},
          },
          responses: { '201': { description: 'Application submitted' } },
        },
      },
      '/api/applications/{id}/status': {
        patch: {
          tags: ['Applications'],
          summary: 'Update application status',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: { type: 'string', enum: ['APPLIED', 'REVIEWING', 'INTERVIEWING', 'REJECTED', 'OFFER'] },
              },
            }}},
          },
          responses: { '200': { description: 'Status updated' } },
        },
      },
      '/api/blog': {
        get: {
          tags: ['Blog'],
          summary: 'List blog posts',
          responses: { '200': { description: 'Blog list' } },
        },
        post: {
          tags: ['Blog'],
          summary: 'Create a blog post',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['title', 'content', 'excerpt', 'author', 'slug', 'image', 'tags'],
              properties: {
                title: { type: 'string' },
                excerpt: { type: 'string' },
                content: { type: 'string' },
                author: { type: 'string' },
                slug: { type: 'string' },
                image: { type: 'string' },
                tags: { type: 'string' },
              },
            }}},
          },
          responses: { '201': { description: 'Blog post created' } },
        },
      },
      '/api/blog/{slug}': {
        get: {
          tags: ['Blog'],
          summary: 'Get blog post by slug',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Blog post' }, '404': { description: 'Not found' } },
        },
        delete: {
          tags: ['Blog'],
          summary: 'Delete blog post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Blog post deleted' } },
        },
      },
      '/api/contact': {
        post: {
          tags: ['Contact'],
          summary: 'Submit a contact message',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['name', 'email', 'message'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                subject: { type: 'string' },
                message: { type: 'string' },
              },
            }}},
          },
          responses: { '201': { description: 'Message sent' } },
        },
      },
      '/api/pricing': {
        get: {
          tags: ['Pricing'],
          summary: 'Get pricing plans',
          responses: { '200': { description: 'Pricing plans' } },
        },
      },
      '/api/upload/resume': {
        post: {
          tags: ['Upload'],
          summary: 'Upload resume PDF',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'multipart/form-data': { schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
            }}},
          },
          responses: { '200': { description: 'File uploaded' } },
        },
      },
      '/api/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List all users',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'User list' } },
        },
      },
      '/api/admin/users/{id}/role': {
        patch: {
          tags: ['Admin'],
          summary: 'Update user role',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['role'],
              properties: { role: { type: 'string', enum: ['SEEKER', 'EMPLOYER', 'ADMIN'] } },
            }}},
          },
          responses: { '200': { description: 'Role updated' } },
        },
      },
      '/api/admin/jobs': {
        get: {
          tags: ['Admin'],
          summary: 'List all jobs',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Job list' } },
        },
      },
      '/api/admin/jobs/{id}': {
        delete: {
          tags: ['Admin'],
          summary: 'Delete any job',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Job deleted' } },
        },
      },
      '/api/admin/blog-posts': {
        get: {
          tags: ['Admin'],
          summary: 'List all blog posts',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Blog post list' } },
        },
      },
      '/api/admin/blog-posts/{id}': {
        delete: {
          tags: ['Admin'],
          summary: 'Delete any blog post',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Blog post deleted' } },
        },
      },
    },
  },
  apis: [],
}

export const swaggerSpec = swaggerJsdoc(options)
