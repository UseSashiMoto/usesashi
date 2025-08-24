import { AIFieldEnum, AIFunction, registerFunctionIntoAI } from "@sashimo/lib";

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

// Create AI Functions using proper AIFunction class
const GetAllContentFunction = new AIFunction("get_all_content", "Retrieve all content items")
  .implement(async () => {
    return {
      content: content,
      total: content.length,
      published: content.filter(c => c.status === "published").length,
      drafts: content.filter(c => c.status === "draft").length
    }
  });

const GetContentByTypeFunction = new AIFunction("get_content_by_type", "Get content filtered by type")
  .args(new AIFieldEnum("type", "Content type to filter by", ["blog", "tutorial", "guide", "article"], true))
  .implement(async (type: string) => {
    const filteredContent = content.filter(c => c.type === type)
    return {
      content: filteredContent,
      count: filteredContent.length,
      type: type
    }
  });

const CreateContentFunction = new AIFunction("create_content", "Create a new content item")
  .args({
    name: "title",
    type: "string",
    description: "Content title",
    required: true
  })
  .args({
    name: "content",
    type: "string",
    description: "Content body",
    required: true
  })
  .args(new AIFieldEnum("type", "Content type", ["blog", "tutorial", "guide", "article"], true))
  .args({
    name: "author",
    type: "string",
    description: "Content author",
    required: true
  })
  .implement(async (title: string, body: string, type: string, author: string) => {
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
  });

const SearchContentFunction = new AIFunction("search_content", "Search content by title or content text")
  .args({
    name: "query",
    type: "string",
    description: "Search query",
    required: true
  })
  .implement(async (query: string) => {
    const searchResults = content.filter(c =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.content.toLowerCase().includes(query.toLowerCase())
    )
    return {
      results: searchResults,
      count: searchResults.length,
      query: query
    }
  });

// Register all functions properly with AIFunction instances
registerFunctionIntoAI("get_all_content", GetAllContentFunction);
registerFunctionIntoAI("get_content_by_type", GetContentByTypeFunction);
registerFunctionIntoAI("create_content", CreateContentFunction);
registerFunctionIntoAI("search_content", SearchContentFunction);