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
const myDB = generateDB<User>(data)

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

const GetUserByIdFunction = new AIFunction("get_user_by_id", " get a user by id")
    .args({
        name: "userId",
        description: "a users id",
        type: "number",
        required: true
    })
    .returns(UserObject)
    .implement(async (userId: number) => {
        const user = await getUserById(userId)
        return user
    })

const GetAllUserFunction = new AIFunction(
    "get_all_users",
    "gets all the users in the system",
    "",
    true
)

    .returns(new AIArray("users", "all users", UserObject))
    .implement(async () => {
        const users = await getAllUsers()
        return users.map((user) => user.data)
    })
    .confirmation(true)

registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction)
registerFunctionIntoAI("get_all_users", GetAllUserFunction)
