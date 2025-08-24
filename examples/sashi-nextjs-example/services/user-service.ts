import { AIFieldEnum, AIFunction, registerFunctionIntoAI } from "@sashimo/lib";

// Sample user data for demonstration
const users = [
  { id: 1, name: "Alice Smith", email: "alice@example.com", role: "admin", active: true },
  { id: 2, name: "Bob Johnson", email: "bob@example.com", role: "user", active: true },
  { id: 3, name: "Carol Davis", email: "carol@example.com", role: "user", active: false },
  { id: 4, name: "David Wilson", email: "david@example.com", role: "moderator", active: true },
]

// Create AI Functions using proper AIFunction class
const GetAllUsersFunction = new AIFunction("get_all_users", "Retrieve all users in the system")
  .implement(async () => {
    return {
      users: users,
      total: users.length,
      active: users.filter(u => u.active).length
    }
  });

const GetUserByIdFunction = new AIFunction("get_user_by_id", "Get a specific user by their ID")
  .args({
    name: "userId",
    type: "number",
    description: "The ID of the user to retrieve",
    required: true
  })
  .implement(async (userId: number) => {
    const user = users.find(u => u.id === userId)
    if (!user) {
      throw new Error(`User with ID ${userId} not found`)
    }
    return user
  });

const CreateUserFunction = new AIFunction("create_user", "Create a new user account")
  .args({
    name: "name",
    type: "string",
    description: "User's full name",
    required: true
  })
  .args({
    name: "email",
    type: "string",
    description: "User's email address",
    required: true
  })
  .args(new AIFieldEnum("role", "User's role", ["user", "moderator", "admin"], false))
  .implement(async (name: string, email: string, role?: string) => {
    const newId = Math.max(...users.map(u => u.id)) + 1
    const newUser = {
      id: newId,
      name,
      email,
      role: role || "user",
      active: true
    }
    users.push(newUser)
    return {
      message: "User created successfully",
      user: newUser
    }
  });

const GetActiveUsersFunction = new AIFunction("get_active_users", "Get all active users")
  .implement(async () => {
    const activeUsers = users.filter(u => u.active)
    return {
      users: activeUsers,
      count: activeUsers.length
    }
  });

// Register all functions properly with AIFunction instances
registerFunctionIntoAI("get_all_users", GetAllUsersFunction);
registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction);
registerFunctionIntoAI("create_user", CreateUserFunction);
registerFunctionIntoAI("get_active_users", GetActiveUsersFunction);