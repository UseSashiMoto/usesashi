import { AIFieldEnum, AIFunction, registerFunctionIntoAI } from "@sashimo/lib";

// Firebase-style user data (could be from Firestore)
const users = [
  { id: "user_1", name: "Alice Firebase", email: "alice@firebase.com", role: "admin", active: true, createdAt: "2024-01-01" },
  { id: "user_2", name: "Bob Cloud", email: "bob@firebase.com", role: "user", active: true, createdAt: "2024-01-02" },
  { id: "user_3", name: "Carol Functions", email: "carol@firebase.com", role: "user", active: false, createdAt: "2024-01-03" },
  { id: "user_4", name: "David Serverless", email: "david@firebase.com", role: "moderator", active: true, createdAt: "2024-01-04" },
]

const GetAllFirebaseUsersFunction = new AIFunction("get_all_firebase_users", "Retrieve all users from Firebase backend")
  .implement(async () => {
    return {
      users: users,
      total: users.length,
      active: users.filter(u => u.active).length,
      source: "Firebase Functions"
    }
  });

const GetFirebaseUserByIdFunction = new AIFunction("get_firebase_user_by_id", "Get a specific user by their Firebase ID")
  .args({
    name: "userId",
    type: "string",
    description: "The Firebase ID of the user to retrieve",
    required: true
  })
  .implement(async (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) {
      throw new Error(`User with ID ${userId} not found in Firebase`)
    }
    return {
      ...user,
      source: "Firebase Functions"
    }
  });

const CreateFirebaseUserFunction = new AIFunction("create_firebase_user", "Create a new user in Firebase backend")
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
    const newId = `user_${Date.now()}`
    const newUser = {
      id: newId,
      name,
      email,
      role: role || "user",
      active: true,
      createdAt: new Date().toISOString().split('T')[0]
    }
    users.push(newUser)
    return {
      message: "User created successfully in Firebase",
      user: newUser,
      source: "Firebase Functions"
    }
  });

const GetFirebaseActiveUsersFunction = new AIFunction("get_firebase_active_users", "Get all active users from Firebase")
  .implement(async () => {
    const activeUsers = users.filter(u => u.active)
    return {
      users: activeUsers,
      count: activeUsers.length,
      source: "Firebase Functions"
    }
  });

const DeactivateFirebaseUserFunction = new AIFunction("deactivate_firebase_user", "Deactivate a user in Firebase")
  .args({
    name: "userId",
    type: "string",
    description: "The Firebase ID of the user to deactivate",
    required: true
  })
  .implement(async (userId: string) => {
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
  });

// Register all functions properly with AIFunction instances
registerFunctionIntoAI("get_all_firebase_users", GetAllFirebaseUsersFunction);
registerFunctionIntoAI("get_firebase_user_by_id", GetFirebaseUserByIdFunction);
registerFunctionIntoAI("create_firebase_user", CreateFirebaseUserFunction);
registerFunctionIntoAI("get_firebase_active_users", GetFirebaseActiveUsersFunction);
registerFunctionIntoAI("deactivate_firebase_user", DeactivateFirebaseUserFunction);