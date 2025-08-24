import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// In-memory database types and implementation
interface Data<T> {
    id: number
    data: T
}

class InMemoryDB<T> {
    private store: Map<number, Data<T>> = new Map()

    constructor(initialData: Data<T>[] = []) {
        initialData.forEach(item => {
            this.store.set(item.id, item)
        })
    }

    getAll(): Data<T>[] {
        return Array.from(this.store.values())
    }

    getById(id: number): Data<T> | undefined {
        return this.store.get(id)
    }

    add(item: Data<T>): void {
        this.store.set(item.id, item)
    }

    update(id: number, data: T): void {
        const existing = this.store.get(id)
        if (existing) {
            this.store.set(id, { id, data })
        }
    }

    remove(id: number): boolean {
        return this.store.delete(id)
    }
}

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

const myDB = new InMemoryDB<User>(data)

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



// Register all functions using the new format
registerFunctionIntoAI({
    name: "get_user_by_id",
    description: "retrieve a specific user by their ID",
    parameters: {
        userId: {
            type: "number",
            description: "the unique identifier of the user",
            required: true
        }
    },
    handler: async ({ userId }) => {
        const user = await getUserById(userId)
        if (!user) throw new Error(`User with id ${userId} not found`)
        return { ...user.data, id: user.id }
    }
})

registerFunctionIntoAI({
    name: "get_all_users",
    description: "retrieve all users in the system",
    parameters: {},
    handler: async () => {
        const users = await getAllUsers()
        return users.map((user) => ({ ...user.data, id: user.id }))
    }
})

registerFunctionIntoAI({
    name: "create_user",
    description: "create a new user account",
    parameters: {
        name: {
            type: "string",
            description: "the full name of the new user",
            required: true
        },
        email: {
            type: "string",
            description: "the email address for the new user",
            required: true
        },
        role: {
            type: "string",
            description: "the role for the new user (admin, user, moderator)",
            required: false
        }
    },
    handler: async ({ name, email, role }) => {
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
        if (!created) throw new Error("Failed to create user")
        return { ...created.data, id: created.id }
    }
})

registerFunctionIntoAI({
    name: "update_user",
    description: "update an existing user's information",
    parameters: {
        userId: {
            type: "number",
            description: "the ID of the user to update",
            required: true
        },
        name: {
            type: "string",
            description: "the new name for the user",
            required: false
        },
        email: {
            type: "string",
            description: "the new email for the user",
            required: false
        },
        role: {
            type: "string",
            description: "the new role for the user",
            required: false
        }
    },
    handler: async ({ userId, name, email, role }) => {
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
    }
})

registerFunctionIntoAI({
    name: "deactivate_user",
    description: "deactivate a user account",
    parameters: {
        userId: {
            type: "number",
            description: "the ID of the user to deactivate",
            required: true
        }
    },
    handler: async ({ userId }) => {
        const updated = await deactivateUser(userId)
        if (!updated) throw new Error(`Failed to deactivate user ${userId}`)
        return { ...updated.data, id: updated.id }
    }
})

registerFunctionIntoAI({
    name: "get_users_by_role",
    description: "retrieve all users with a specific role",
    parameters: {
        role: {
            type: "string",
            description: "the role to filter by (admin, user, moderator)",
            required: true
        }
    },
    handler: async ({ role }) => {
        const users = await getUsersByRole(role)
        return users.map((user) => ({ ...user.data, id: user.id }))
    }
})

registerFunctionIntoAI({
    name: "get_active_users",
    description: "retrieve all active users",
    parameters: {},
    handler: async () => {
        const users = await getAllUsers()
        const activeUsers = users.filter(user => user.data.isActive !== false)
        return activeUsers.map((user) => ({ ...user.data, id: user.id }))
    }
})