import { registerFunction } from "@sashimo/lib"

// Sample user data for demonstration
const users = [
  { id: 1, name: "Alice Smith", email: "alice@example.com", role: "admin", active: true },
  { id: 2, name: "Bob Johnson", email: "bob@example.com", role: "user", active: true },
  { id: 3, name: "Carol Davis", email: "carol@example.com", role: "user", active: false },
  { id: 4, name: "David Wilson", email: "david@example.com", role: "moderator", active: true },
]

registerFunction({
  name: "get_all_users",
  description: "Retrieve all users in the system",
  parameters: {},
  handler: async () => {
    return {
      users: users,
      total: users.length,
      active: users.filter(u => u.active).length
    }
  }
})

registerFunction({
  name: "get_user_by_id",
  description: "Get a specific user by their ID",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "number",
        description: "The ID of the user to retrieve"
      }
    },
    required: ["userId"]
  },
  handler: async ({ userId }: { userId: number }) => {
    const user = users.find(u => u.id === userId)
    if (!user) {
      throw new Error(`User with ID ${userId} not found`)
    }
    return user
  }
})

registerFunction({
  name: "create_user",
  description: "Create a new user account",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "User's full name"
      },
      email: {
        type: "string",
        description: "User's email address"
      },
      role: {
        type: "string",
        description: "User's role",
        enum: ["user", "moderator", "admin"]
      }
    },
    required: ["name", "email"]
  },
  handler: async ({ name, email, role = "user" }: { name: string, email: string, role?: string }) => {
    const newId = Math.max(...users.map(u => u.id)) + 1
    const newUser = {
      id: newId,
      name,
      email,
      role,
      active: true
    }
    users.push(newUser)
    return {
      message: "User created successfully",
      user: newUser
    }
  }
})

registerFunction({
  name: "get_active_users",
  description: "Get all active users",
  parameters: {},
  handler: async () => {
    const activeUsers = users.filter(u => u.active)
    return {
      users: activeUsers,
      count: activeUsers.length
    }
  }
})