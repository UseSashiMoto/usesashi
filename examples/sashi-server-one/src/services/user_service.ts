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
}

// TypeScript can also infer your dataSchema type! :D
const data: Data<User>[] = [
    {
        id: 0,
        data: {
            name: "John Doe",
            email: "john@example.com",
            password: "password"
        }
    },
    {
        id: 1,
        data: {
            name: "Brad Pitt",
            email: "brad@example.com",
            password: "password"
        }
    },
    {
        id: 2,
        data: {
            name: "Michael Jackson",
            email: "michael@example.com",
            password: "password"
        }
    }
]
const myDB = new InMemoryDB<User>(data)

export const getAllUsers = async () => {
    return myDB.getAll()
}

export const addUser = async (user: User) => {
    return myDB.add({
        id: myDB.getAll().length,
        data: user
    })
}

export const removeUser = async (id: number) => {
    return myDB.remove(id)
}

export const updateUser = async (id: number, user: User) => {
    return myDB.update(id, user)
}

export const getUserById = async (id: number) => {
    return myDB.getById(id)
}

const UserObject = new AIObject("User", "a user in the system", true)
    .field({
        name: "email",
        description: "the email of the user",
        type: "string",
        required: true
    })
    .field({
        name: "id",
        description: "a user id in the system",
        type: "number",
        required: true
    })
    .field({
        name: "name",
        description: "the name of the user",
        type: "string",
        required: true
    })

registerFunctionIntoAI({
    name: "get_user_by_id",
    description: "get a user by id",
    parameters: {
        userId: {
            type: "number",
            description: "a users id",
            required: true
        }
    },
    handler: async ({ userId }) => {
        const user = await getUserById(userId)
        return user
    }
})

registerFunctionIntoAI({
    name: "get_all_users",
    description: "gets all the users in the system",
    parameters: {},
    handler: async () => {
        const users = await getAllUsers()
        return users.map((user) => ({ ...user.data, id: user.id }))
    }
})
