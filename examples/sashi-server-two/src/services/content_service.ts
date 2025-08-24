import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// Content-related interfaces
interface ContentItem {
    id: string
    title: string
    content: string
    type: 'article' | 'page' | 'blog_post' | 'documentation'
    status: 'draft' | 'published' | 'archived'
    authorId: string
    createdAt: string
    updatedAt: string
    publishedAt?: string
    tags: string[]
    metadata: {
        excerpt?: string
        featuredImage?: string
        seo?: {
            title?: string
            description?: string
            keywords?: string[]
        }
    }
    viewCount: number
    likeCount: number
}

interface ContentCategory {
    id: string
    name: string
    slug: string
    description: string
    parentId?: string
    itemCount: number
    createdAt: string
}

// Mock data
const contentItems: ContentItem[] = [
    {
        id: 'content_001',
        title: 'Getting Started with Sashi',
        content: 'Welcome to Sashi! This guide will help you set up your first AI-powered admin interface...',
        type: 'documentation',
        status: 'published',
        authorId: 'user_123',
        createdAt: '2024-07-15T10:00:00Z',
        updatedAt: '2024-08-01T14:30:00Z',
        publishedAt: '2024-07-20T09:00:00Z',
        tags: ['getting-started', 'tutorial', 'setup'],
        metadata: {
            excerpt: 'Learn how to set up your first AI-powered admin interface with Sashi',
            seo: {
                title: 'Getting Started with Sashi - Complete Setup Guide',
                description: 'Step-by-step tutorial for setting up Sashi AI admin interface',
                keywords: ['sashi', 'ai', 'admin', 'setup', 'tutorial']
            }
        },
        viewCount: 1250,
        likeCount: 89
    },
    {
        id: 'content_002',
        title: 'Advanced Workflow Configuration',
        content: 'Learn how to create complex workflows that connect multiple functions...',
        type: 'article',
        status: 'published',
        authorId: 'user_456',
        createdAt: '2024-08-01T11:00:00Z',
        updatedAt: '2024-08-10T16:45:00Z',
        publishedAt: '2024-08-05T10:00:00Z',
        tags: ['workflows', 'advanced', 'configuration'],
        metadata: {
            excerpt: 'Master advanced workflow configurations and automation',
            featuredImage: 'https://example.com/images/workflow-banner.jpg',
            seo: {
                title: 'Advanced Workflow Configuration in Sashi',
                description: 'Learn to create complex automated workflows with Sashi',
                keywords: ['workflows', 'automation', 'advanced', 'configuration']
            }
        },
        viewCount: 756,
        likeCount: 43
    },
    {
        id: 'content_003',
        title: 'Security Best Practices',
        content: 'Implementing secure authentication and authorization in your Sashi deployment...',
        type: 'blog_post',
        status: 'draft',
        authorId: 'user_789',
        createdAt: '2024-08-12T09:30:00Z',
        updatedAt: '2024-08-15T11:20:00Z',
        tags: ['security', 'authentication', 'best-practices'],
        metadata: {
            excerpt: 'Essential security practices for Sashi implementations',
            seo: {
                title: 'Security Best Practices for Sashi',
                description: 'Learn how to secure your Sashi admin interface properly',
                keywords: ['security', 'authentication', 'best-practices', 'sashi']
            }
        },
        viewCount: 0,
        likeCount: 0
    }
]

const contentCategories: ContentCategory[] = [
    {
        id: 'cat_001',
        name: 'Documentation',
        slug: 'documentation',
        description: 'Official documentation and guides',
        itemCount: 1,
        createdAt: '2024-07-01T00:00:00Z'
    },
    {
        id: 'cat_002',
        name: 'Tutorials',
        slug: 'tutorials',
        description: 'Step-by-step tutorials and how-to guides',
        parentId: 'cat_001',
        itemCount: 1,
        createdAt: '2024-07-01T00:00:00Z'
    },
    {
        id: 'cat_003',
        name: 'Blog',
        slug: 'blog',
        description: 'Latest news and insights',
        itemCount: 1,
        createdAt: '2024-07-01T00:00:00Z'
    }
]

// Helper functions
const generateContentId = () => `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
const generateCategoryId = () => `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const createSlug = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// AI Object definitions
const ContentMetadataObject = new AIObject("ContentMetadata", "content metadata and SEO information", true)
    .field({
        name: "excerpt",
        description: "short excerpt or summary of the content",
        type: "string",
        required: false
    })
    .field({
        name: "featuredImage",
        description: "URL of the featured image",
        type: "string",
        required: false
    })
    .field({
        name: "seo",
        description: "SEO metadata (title, description, keywords)",
        type: "object",
        required: false
    })

const ContentItemObject = new AIObject("ContentItem", "content item with full details", true)
    .field({
        name: "id",
        description: "unique content identifier",
        type: "string",
        required: true
    })
    .field({
        name: "title",
        description: "content title",
        type: "string",
        required: true
    })
    .field({
        name: "content",
        description: "main content body",
        type: "string",
        required: true
    })
    .field({
        name: "type",
        description: "content type (article, page, blog_post, documentation)",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "publication status (draft, published, archived)",
        type: "string",
        required: true
    })
    .field({
        name: "authorId",
        description: "ID of the content author",
        type: "string",
        required: true
    })
    .field({
        name: "createdAt",
        description: "when the content was created",
        type: "string",
        required: true
    })
    .field({
        name: "updatedAt",
        description: "when the content was last updated",
        type: "string",
        required: true
    })
    .field({
        name: "publishedAt",
        description: "when the content was published",
        type: "string",
        required: false
    })
    .field({
        name: "tags",
        description: "content tags",
        type: "array",
        required: false
    })
    .field({
        name: "metadata",
        description: "additional content metadata",
        type: "object",
        required: false
    })
    .field({
        name: "viewCount",
        description: "number of views",
        type: "number",
        required: true
    })
    .field({
        name: "likeCount",
        description: "number of likes",
        type: "number",
        required: true
    })

const ContentCategoryObject = new AIObject("ContentCategory", "content category information", true)
    .field({
        name: "id",
        description: "unique category identifier",
        type: "string",
        required: true
    })
    .field({
        name: "name",
        description: "category name",
        type: "string",
        required: true
    })
    .field({
        name: "slug",
        description: "URL-friendly category slug",
        type: "string",
        required: true
    })
    .field({
        name: "description",
        description: "category description",
        type: "string",
        required: true
    })
    .field({
        name: "parentId",
        description: "parent category ID (for hierarchical categories)",
        type: "string",
        required: false
    })
    .field({
        name: "itemCount",
        description: "number of content items in this category",
        type: "number",
        required: true
    })
    .field({
        name: "createdAt",
        description: "when the category was created",
        type: "string",
        required: true
    })

// Register all content functions using the new format
registerFunctionIntoAI({
    name: "create_content",
    description: "create a new content item",
    parameters: {
        title: {
            type: "string",
            description: "content title",
            required: true
        },
        content: {
            type: "string",
            description: "main content body",
            required: true
        },
        type: {
            type: "string",
            description: "content type (article, page, blog_post, documentation)",
            required: true
        },
        authorId: {
            type: "string",
            description: "ID of the content author",
            required: true
        },
        status: {
            type: "string",
            description: "publication status (draft, published, archived)",
            required: false
        },
        tags: {
            type: "string",
            description: "comma-separated tags",
            required: false
        },
        excerpt: {
            type: "string",
            description: "content excerpt or summary",
            required: false
        }
    },
    handler: async ({ title, content, type, authorId, status = 'draft', tags = '', excerpt }) => {
        const contentId = generateContentId()
        const timestamp = new Date().toISOString()

        // Validate inputs
        if (!title.trim()) {
            throw new Error("Title cannot be empty")
        }

        if (!content.trim()) {
            throw new Error("Content cannot be empty")
        }

        if (!['article', 'page', 'blog_post', 'documentation'].includes(type)) {
            throw new Error("Invalid content type")
        }

        if (!['draft', 'published', 'archived'].includes(status)) {
            throw new Error("Invalid status")
        }

        // Process tags
        const contentTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : []

        // Generate excerpt if not provided
        const autoExcerpt = excerpt || content.substring(0, 150).trim() + (content.length > 150 ? '...' : '')

        const newContent: ContentItem = {
            id: contentId,
            title,
            content,
            type: type as any,
            status: status as any,
            authorId,
            createdAt: timestamp,
            updatedAt: timestamp,
            publishedAt: status === 'published' ? timestamp : undefined,
            tags: contentTags,
            metadata: {
                excerpt: autoExcerpt
            },
            viewCount: 0,
            likeCount: 0
        }

        contentItems.push(newContent)

        console.log('📝 [Content Service] Content created:', {
            id: contentId,
            title,
            type,
            status,
            authorId,
            tags: contentTags
        })

        return newContent
    }
})

registerFunctionIntoAI({
    name: "get_all_content",
    description: "retrieve all content items",
    parameters: {},
    handler: async () => {
        // Sort by creation date (newest first)
        const sortedContent = [...contentItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return sortedContent
    }
})

registerFunctionIntoAI({
    name: "get_published_content",
    description: "retrieve only published content items",
    parameters: {},
    handler: async () => {
        const publishedContent = contentItems.filter(item => item.status === 'published')
        return publishedContent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
})

registerFunctionIntoAI({
    name: "get_draft_content",
    description: "retrieve only draft content items",
    parameters: {},
    handler: async () => {
        const draftContent = contentItems.filter(item => item.status === 'draft')
        return draftContent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
})

registerFunctionIntoAI({
    name: "get_content_by_type",
    description: "retrieve content items by type",
    parameters: {
        type: {
            type: "string",
            description: "content type (article, page, blog_post, documentation)",
            required: true
        }
    },
    handler: async ({ type }) => {
        const filteredContent = contentItems.filter(item => item.type === type)
        return filteredContent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
})

registerFunctionIntoAI({
    name: "get_content_by_id",
    description: "retrieve a specific content item by ID",
    parameters: {
        contentId: {
            type: "string",
            description: "unique content identifier",
            required: true
        }
    },
    handler: async ({ contentId }) => {
        const content = contentItems.find(item => item.id === contentId)

        if (!content) {
            throw new Error(`Content with ID ${contentId} not found`)
        }

        // Increment view count
        content.viewCount++

        console.log('👁️ [Content Service] Content viewed:', {
            id: contentId,
            title: content.title,
            viewCount: content.viewCount
        })

        return content
    }
})

registerFunctionIntoAI({
    name: "update_content",
    description: "update an existing content item",
    parameters: {
        contentId: {
            type: "string",
            description: "ID of content to update",
            required: true
        },
        title: {
            type: "string",
            description: "new title",
            required: false
        },
        content: {
            type: "string",
            description: "new content body",
            required: false
        },
        status: {
            type: "string",
            description: "new status",
            required: false
        },
        tags: {
            type: "string",
            description: "new comma-separated tags",
            required: false
        }
    },
    handler: async ({ contentId, title, content, status, tags }) => {
        const contentItem = contentItems.find(item => item.id === contentId)

        if (!contentItem) {
            throw new Error(`Content with ID ${contentId} not found`)
        }

        const timestamp = new Date().toISOString()

        // Update fields if provided
        if (title) contentItem.title = title
        if (content) contentItem.content = content
        if (status) {
            if (!['draft', 'published', 'archived'].includes(status)) {
                throw new Error("Invalid status")
            }
            contentItem.status = status as any

            // Set published date if publishing for the first time
            if (status === 'published' && !contentItem.publishedAt) {
                contentItem.publishedAt = timestamp
            }
        }
        if (tags !== undefined) {
            contentItem.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : []
        }

        contentItem.updatedAt = timestamp

        console.log('✏️ [Content Service] Content updated:', {
            id: contentId,
            title: contentItem.title,
            status: contentItem.status
        })

        return contentItem
    }
})

registerFunctionIntoAI({
    name: "publish_content",
    description: "publish a draft content item",
    parameters: {
        contentId: {
            type: "string",
            description: "ID of content to publish",
            required: true
        }
    },
    handler: async ({ contentId }) => {
        const contentItem = contentItems.find(item => item.id === contentId)

        if (!contentItem) {
            throw new Error(`Content with ID ${contentId} not found`)
        }

        if (contentItem.status === 'published') {
            throw new Error("Content is already published")
        }

        const timestamp = new Date().toISOString()
        contentItem.status = 'published'
        contentItem.publishedAt = timestamp
        contentItem.updatedAt = timestamp

        console.log('🚀 [Content Service] Content published:', {
            id: contentId,
            title: contentItem.title,
            publishedAt: timestamp
        })

        return contentItem
    }
})

registerFunctionIntoAI({
    name: "search_content",
    description: "search content by title, content, or tags",
    parameters: {
        query: {
            type: "string",
            description: "search query",
            required: true
        },
        type: {
            type: "string",
            description: "filter by content type",
            required: false
        },
        status: {
            type: "string",
            description: "filter by status (default: published)",
            required: false
        }
    },
    handler: async ({ query, type, status = 'published' }) => {
        const searchTerm = query.toLowerCase()

        let results = contentItems.filter(item => {
            const matchesQuery =
                item.title.toLowerCase().includes(searchTerm) ||
                item.content.toLowerCase().includes(searchTerm) ||
                item.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
                (item.metadata.excerpt && item.metadata.excerpt.toLowerCase().includes(searchTerm))

            const matchesType = !type || item.type === type
            const matchesStatus = !status || item.status === status

            return matchesQuery && matchesType && matchesStatus
        })

        // Sort by relevance (title matches first, then content matches)
        results.sort((a, b) => {
            const aTitle = a.title.toLowerCase().includes(searchTerm)
            const bTitle = b.title.toLowerCase().includes(searchTerm)

            if (aTitle && !bTitle) return -1
            if (!aTitle && bTitle) return 1

            // Secondary sort by view count
            return b.viewCount - a.viewCount
        })

        console.log('🔍 [Content Service] Content searched:', {
            query,
            resultsCount: results.length,
            type,
            status
        })

        return results
    }
})

registerFunctionIntoAI({
    name: "get_content_stats",
    description: "get content statistics and metrics",
    parameters: {},
    handler: async () => {
        const totalItems = contentItems.length
        const totalViews = contentItems.reduce((sum, item) => sum + item.viewCount, 0)
        const totalLikes = contentItems.reduce((sum, item) => sum + item.likeCount, 0)

        // Group by status
        const byStatus = contentItems.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        // Group by type
        const byType = contentItems.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        // Find most popular
        const mostPopular = contentItems.reduce((max, item) =>
            item.viewCount > (max?.viewCount || 0) ? item : max, contentItems[0] || null)

        return {
            totalItems,
            byStatus,
            byType,
            totalViews,
            totalLikes,
            mostPopular: mostPopular ? {
                id: mostPopular.id,
                title: mostPopular.title,
                viewCount: mostPopular.viewCount,
                likeCount: mostPopular.likeCount
            } : null
        }
    }
})