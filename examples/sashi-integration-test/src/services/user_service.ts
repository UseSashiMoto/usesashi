import {
    AIArray,
    AIFunction,
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"
import generateDB from "your-db"
import { Data } from "your-db/lib/types"

export interface User {
    name: string
    email: string
    password: string
    role?: 'admin' | 'user' | 'moderator'
    createdAt?: string
    lastLogin?: string
    isActive?: boolean
    preferences?: {
        theme: 'light' | 'dark'
        notifications: boolean
        language: string
    }
}

// Extended test data with more realistic user profiles
const data: Data<User>[] = [
    {
        id: 0,
        data: {
            name: "John Doe",
            email: "john@example.com",
            password: "password",
            role: "admin",
            createdAt: "2024-01-15T10:30:00Z",
            lastLogin: "2024-08-15T09:15:00Z",
            isActive: true,
            preferences: {
                theme: "dark",
                notifications: true,
                language: "en"
            }
        }
    },
    {
        id: 1,
        data: {
            name: "Sarah Wilson",
            email: "sarah@example.com",
            password: "password",
            role: "user",
            createdAt: "2024-02-20T14:45:00Z",
            lastLogin: "2024-08-14T16:30:00Z",
            isActive: true,
            preferences: {
                theme: "light",
                notifications: false,
                language: "en"
            }
        }
    },
    {
        id: 2,
        data: {
            name: "Michael Chen",
            email: "michael@example.com",
            password: "password",
            role: "moderator",
            createdAt: "2024-03-10T08:20:00Z",
            lastLogin: "2024-08-13T11:45:00Z",
            isActive: true,
            preferences: {
                theme: "dark",
                notifications: true,
                language: "zh"
            }
        }
    },
    {
        id: 3,
        data: {
            name: "Emma Rodriguez",
            email: "emma@example.com",
            password: "password",
            role: "user",
            createdAt: "2024-04-05T12:10:00Z",
            lastLogin: "2024-08-10T14:20:00Z",
            isActive: false,
            preferences: {
                theme: "light",
                notifications: true,
                language: "es"
            }
        }
    }
]

const myDB = generateDB<User>(data)

// Database operations
export const getAllUsers = async () => {
    return myDB.getAll()
}

export const addUser = async (user: User) => {
    const newUser = {
        ...user,
        createdAt: new Date().toISOString(),
        isActive: true,
        role: user.role || 'user',
        preferences: user.preferences || {
            theme: 'light',
            notifications: true,
            language: 'en'
        }
    }
    const id = myDB.getAll().length
    myDB.add({
        id,
        data: newUser
    })
    return myDB.getById(id)
}

export const removeUser = async (id: number) => {
    return myDB.remove(id)
}

export const updateUser = async (id: number, user: Partial<User>) => {
    const existingUser = myDB.getById(id)
    if (!existingUser) throw new Error(`User with id ${id} not found`)
    
    const updatedUser = { ...existingUser.data, ...user }
    myDB.update(id, updatedUser)
    return myDB.getById(id)
}

export const getUserById = async (id: number) => {
    return myDB.getById(id)
}

export const getUsersByRole = async (role: string) => {
    return myDB.getAll().filter(user => user.data.role === role)
}

export const deactivateUser = async (id: number) => {
    return updateUser(id, { isActive: false })
}

export const activateUser = async (id: number) => {
    return updateUser(id, { isActive: true, lastLogin: new Date().toISOString() })
}

// AI Object definitions
const UserPreferencesObject = new AIObject("UserPreferences", "user preferences and settings", true)
    .field({
        name: "theme",
        description: "the user's preferred theme (light or dark)",
        type: "string",
        required: false
    })
    .field({
        name: "notifications",
        description: "whether the user wants to receive notifications",
        type: "boolean",
        required: false
    })
    .field({
        name: "language",
        description: "the user's preferred language code",
        type: "string",
        required: false
    })

const UserObject = new AIObject("User", "a user in the system", true)
    .field({
        name: "id",
        description: "unique user identifier",
        type: "number",
        required: true
    })
    .field({
        name: "name",
        description: "the full name of the user",
        type: "string",
        required: true
    })
    .field({
        name: "email",
        description: "the email address of the user",
        type: "string",
        required: true
    })
    .field({
        name: "role",
        description: "the user's role (admin, user, moderator)",
        type: "string",
        required: false
    })
    .field({
        name: "createdAt",
        description: "when the user account was created",
        type: "string",
        required: false
    })
    .field({
        name: "lastLogin",
        description: "when the user last logged in",
        type: "string",
        required: false
    })
    .field({
        name: "isActive",
        description: "whether the user account is active",
        type: "boolean",
        required: false
    })
    .field({
        name: "preferences",
        description: "user preferences and settings",
        type: "object",
        required: false
    })

// AI Functions
const GetUserByIdFunction = new AIFunction("get_user_by_id", "retrieve a specific user by their ID")
    .args({
        name: "userId",
        description: "the unique identifier of the user",
        type: "number",
        required: true
    })
    .returns(UserObject)
    .implement(async (userId: number) => {
        const user = await getUserById(userId)
        if (!user) throw new Error(`User with id ${userId} not found`)
        return { ...user.data, id: user.id }
    })

const GetAllUsersFunction = new AIFunction("get_all_users", "retrieve all users in the system")
    .returns(new AIArray("users", "complete list of all users", UserObject))
    .implement(async () => {
        const users = await getAllUsers()
        return users.map((user) => ({ ...user.data, id: user.id }))
    })

const CreateUserFunction = new AIFunction("create_user", "create a new user account")
    .args(
        {
            name: "name",
            description: "the full name of the new user",
            type: "string",
            required: true
        },
        {
            name: "email",
            description: "the email address for the new user",
            type: "string",
            required: true
        },
        {
            name: "role",
            description: "the role for the new user (admin, user, moderator)",
            type: "string",
            required: false
        }
    )
    .returns(UserObject)
    .implement(async (name: string, email: string, role?: string) => {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            throw new Error("Invalid email format")
        }

        // Check if user already exists
        const existingUsers = await getAllUsers()
        const emailExists = existingUsers.some(user => user.data.email === email)
        if (emailExists) {
            throw new Error("User with this email already exists")
        }

        const newUser: User = {
            name,
            email,
            password: "temp_password_123", // In real app, this would be handled securely
            role: (role as any) || 'user'
        }

        const created = await addUser(newUser)
        return { ...created.data, id: created.id }
    })

const UpdateUserFunction = new AIFunction("update_user", "update an existing user's information")
    .args(
        {
            name: "userId",
            description: "the ID of the user to update",
            type: "number",
            required: true
        },
        {
            name: "name",
            description: "the new name for the user",
            type: "string",
            required: false
        },
        {
            name: "email",
            description: "the new email for the user",
            type: "string",
            required: false
        },
        {
            name: "role",
            description: "the new role for the user",
            type: "string",
            required: false
        }
    )
    .returns(UserObject)
    .implement(async (userId: number, name?: string, email?: string, role?: string) => {
        const updates: Partial<User> = {}
        if (name) updates.name = name
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(email)) {
                throw new Error("Invalid email format")
            }
            updates.email = email
        }
        if (role) updates.role = role as any

        const updated = await updateUser(userId, updates)
        if (!updated) throw new Error(`Failed to update user ${userId}`)
        return { ...updated.data, id: updated.id }
    })

const DeactivateUserFunction = new AIFunction("deactivate_user", "deactivate a user account")
    .args({
        name: "userId",
        description: "the ID of the user to deactivate",
        type: "number",
        required: true
    })
    .returns(UserObject)
    .implement(async (userId: number) => {
        const updated = await deactivateUser(userId)
        if (!updated) throw new Error(`Failed to deactivate user ${userId}`)
        return { ...updated.data, id: updated.id }
    })

const GetUsersByRoleFunction = new AIFunction("get_users_by_role", "retrieve all users with a specific role")
    .args({
        name: "role",
        description: "the role to filter by (admin, user, moderator)",
        type: "string",
        required: true
    })
    .returns(new AIArray("users", "users with the specified role", UserObject))
    .implement(async (role: string) => {
        const users = await getUsersByRole(role)
        return users.map((user) => ({ ...user.data, id: user.id }))
    })

const GetActiveUsersFunction = new AIFunction("get_active_users", "retrieve all active users")
    .returns(new AIArray("users", "all active users in the system", UserObject))
    .implement(async () => {
        const users = await getAllUsers()
        const activeUsers = users.filter(user => user.data.isActive !== false)
        return activeUsers.map((user) => ({ ...user.data, id: user.id }))
    })

// Register all functions
registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction)
registerFunctionIntoAI("get_all_users", GetAllUsersFunction)
registerFunctionIntoAI("create_user", CreateUserFunction)
registerFunctionIntoAI("update_user", UpdateUserFunction)
registerFunctionIntoAI("deactivate_user", DeactivateUserFunction)
registerFunctionIntoAI("get_users_by_role", GetUsersByRoleFunction)
registerFunctionIntoAI("get_active_users", GetActiveUsersFunction)