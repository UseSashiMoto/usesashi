import { registerFunction } from "@sashimo/lib"

// Firebase-style user data (could be from Firestore)
const users = [
  { id: "user_1", name: "Alice Firebase", email: "alice@firebase.com", role: "admin", active: true, createdAt: "2024-01-01" },
  { id: "user_2", name: "Bob Cloud", email: "bob@firebase.com", role: "user", active: true, createdAt: "2024-01-02" },
  { id: "user_3", name: "Carol Functions", email: "carol@firebase.com", role: "user", active: false, createdAt: "2024-01-03" },
  { id: "user_4", name: "David Serverless", email: "david@firebase.com", role: "moderator", active: true, createdAt: "2024-01-04" },
]

registerFunction({
  name: "get_all_firebase_users",
  description: "Retrieve all users from Firebase backend",
  parameters: {},
  handler: async () => {
    return {
      users: users,
      total: users.length,
      active: users.filter(u => u.active).length,
      source: "Firebase Functions"
    }
  }
})

registerFunction({
  name: "get_firebase_user_by_id",
  description: "Get a specific user by their Firebase ID",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "The Firebase ID of the user to retrieve"
      }
    },
    required: ["userId"]
  },
  handler: async ({ userId }: { userId: string }) => {
    const user = users.find(u => u.id === userId)
    if (!user) {
      throw new Error(`User with ID ${userId} not found in Firebase`)
    }
    return {
      ...user,
      source: "Firebase Functions"
    }
  }
})

registerFunction({
  name: "create_firebase_user",
  description: "Create a new user in Firebase backend",
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
    const newId = `user_${Date.now()}`
    const newUser = {
      id: newId,
      name,
      email,
      role,
      active: true,
      createdAt: new Date().toISOString().split('T')[0]
    }
    users.push(newUser)
    return {
      message: "User created successfully in Firebase",
      user: newUser,
      source: "Firebase Functions"
    }
  }
})

registerFunction({
  name: "get_firebase_active_users",
  description: "Get all active users from Firebase",
  parameters: {},
  handler: async () => {
    const activeUsers = users.filter(u => u.active)
    return {
      users: activeUsers,
      count: activeUsers.length,
      source: "Firebase Functions"
    }
  }
})

registerFunction({
  name: "deactivate_firebase_user",
  description: "Deactivate a user in Firebase",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string", 
        description: "The Firebase ID of the user to deactivate"
      }
    },
    required: ["userId"]
  },
  handler: async ({ userId }: { userId: string }) => {
    const userIndex = users.findIndex(u => u.id === userId)
    if (userIndex === -1) {
      throw new Error(`User with ID ${userId} not found in Firebase`)
    }
    
    users[userIndex].active = false
    return {
      message: `User ${userId} deactivated successfully`,
      user: users[userIndex],
      source: "Firebase Functions"
    }
  }
})