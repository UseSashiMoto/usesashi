import { registerFunction } from "@sashimo/lib"

// Sample content data
const content = [
  { 
    id: 1, 
    title: "Getting Started with Next.js", 
    content: "Learn how to build modern web applications with Next.js", 
    type: "blog", 
    status: "published",
    author: "Alice Smith",
    createdAt: "2024-01-15T10:00:00Z"
  },
  { 
    id: 2, 
    title: "API Routes in Next.js", 
    content: "A comprehensive guide to creating API routes", 
    type: "tutorial", 
    status: "draft",
    author: "Bob Johnson",
    createdAt: "2024-01-16T14:30:00Z"
  },
  { 
    id: 3, 
    title: "Deployment Best Practices", 
    content: "How to deploy Next.js applications to production", 
    type: "guide", 
    status: "published",
    author: "Carol Davis",
    createdAt: "2024-01-17T09:15:00Z"
  }
]

registerFunction({
  name: "get_all_content",
  description: "Retrieve all content items",
  parameters: {},
  handler: async () => {
    return {
      content: content,
      total: content.length,
      published: content.filter(c => c.status === "published").length,
      drafts: content.filter(c => c.status === "draft").length
    }
  }
})

registerFunction({
  name: "get_content_by_type",
  description: "Get content filtered by type",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Content type to filter by",
        enum: ["blog", "tutorial", "guide", "article"]
      }
    },
    required: ["type"]
  },
  handler: async ({ type }: { type: string }) => {
    const filteredContent = content.filter(c => c.type === type)
    return {
      content: filteredContent,
      count: filteredContent.length,
      type: type
    }
  }
})

registerFunction({
  name: "create_content",
  description: "Create a new content item",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Content title"
      },
      content: {
        type: "string", 
        description: "Content body"
      },
      type: {
        type: "string",
        description: "Content type",
        enum: ["blog", "tutorial", "guide", "article"]
      },
      author: {
        type: "string",
        description: "Content author"
      }
    },
    required: ["title", "content", "type", "author"]
  },
  handler: async ({ title, content: body, type, author }: { 
    title: string, 
    content: string, 
    type: string, 
    author: string 
  }) => {
    const newId = Math.max(...content.map(c => c.id)) + 1
    const newContent = {
      id: newId,
      title,
      content: body,
      type,
      status: "draft",
      author,
      createdAt: new Date().toISOString()
    }
    content.push(newContent)
    return {
      message: "Content created successfully",
      content: newContent
    }
  }
})

registerFunction({
  name: "search_content",
  description: "Search content by title or content text",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      }
    },
    required: ["query"]
  },
  handler: async ({ query }: { query: string }) => {
    const searchResults = content.filter(c => 
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.content.toLowerCase().includes(query.toLowerCase())
    )
    return {
      results: searchResults,
      count: searchResults.length,
      query: query
    }
  }
})