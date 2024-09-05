import {AIFunction, AIObject, registerFunctionIntoAI} from "@sashimo/lib"
import generateDB from "your-db"
import {Data} from "your-db/lib/types"

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
    console.log("getUserById", id, typeof id)
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

const GetUserByIdFunction = new AIFunction("get_user_by_id", "getUserById")
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

console.log("registering get_user_by_id function")
registerFunctionIntoAI("get_user_by_id", GetUserByIdFunction)
