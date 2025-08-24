import { AIObject, registerFunctionIntoAI } from "@sashimo/lib"

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

export interface File {
    name: string
    userId: number,
    mimeType: string
}

// TypeScript can also infer your dataSchema type! :D
const data: Data<File>[] = [
    {
        id: 0,
        data: {
            name: "image.png",
            userId: 0,
            mimeType: "image/png"
        }
    },
    {
        id: 1,
        data: {
            name: "happy face.png",
            userId: 0,
            mimeType: "image/png"
        }
    },
    {
        id: 2,
        data: {
            name: "music.mp3",
            userId: 0,
            mimeType: "audio/mp3"
        }
    },
    {
        id: 3,
        data: {
            name: "image1.png",
            userId: 1,
            mimeType: "image/png"
        }
    },
    {
        id: 4,
        data: {
            name: "happy face1.png",
            userId: 1,
            mimeType: "image/png"
        }
    },
    {
        id: 5,
        data: {
            name: "happy face2.png",
            userId: 2,
            mimeType: "image/png"
        }
    },
    {
        id: 6,
        data: {
            name: "music2.mp3",
            userId: 2,
            mimeType: "audio/mp3"
        }
    },
]

const myDB = new InMemoryDB<File>(data)


const getFileByUserId = async (userId: number) => {
    return myDB.getAll().filter((file) => file.data.userId === userId)
}

const getFileById = async (id: number) => {
    return myDB.getById(id)
}

const addFile = async (file: File) => {
    return myDB.add({
        id: myDB.getAll().length,
        data: file
    })
}

const removeFile = async (id: number) => {
    return myDB.remove(id)
}

const updateFile = async (id: number, file: File) => {
    return myDB.update(id, file)
}

const getFileByMimeType = async (mimeType: string) => {
    return myDB.getAll().filter((file) => file.data.mimeType === mimeType)
}

const FileObject = new AIObject("File", "a file in the system", true)
    .field({
        name: "id",
        description: "a file id in the system",
        type: "number",
        required: true
    })
    .field({
        name: "name",
        description: "the name of the file",
        type: "string",
        required: true
    })
    .field({
        name: "userId",
        description: "the user id of the file",
        type: "number",
        required: true
    })


registerFunctionIntoAI({
    name: "get_file_by_user_id",
    description: "gets a file by a user id",
    parameters: {
        userId: {
            type: "number",
            description: "a users id",
            required: true
        }
    },
    handler: async ({ userId }) => {
        const files = await getFileByUserId(userId)
        return files.map((file) => file.data)
    }
})

registerFunctionIntoAI({
    name: "get_file_by_mime_type",
    description: "gets a file by mime type",
    parameters: {
        mimeType: {
            type: "string",
            description: "a file mime type (image/png, audio/mp3)",
            required: true,
            enum: ["image/png", "audio/mp3"]
        }
    },
    handler: async ({ mimeType }) => {
        const files = await getFileByMimeType(mimeType)
        return files.map((file) => file.data)
    }
})

registerFunctionIntoAI({
    name: "get_file_by_id",
    description: "gets a file by id",
    parameters: {
        fileId: {
            type: "number",
            description: "a file id",
            required: true
        }
    },
    handler: async ({ fileId }) => {
        const file = await getFileById(fileId)
        return file
    }
})

registerFunctionIntoAI({
    name: "add_file",
    description: "adds a file",
    parameters: {
        name: {
            type: "string",
            description: "the name of the file",
            required: true
        },
        userId: {
            type: "number",
            description: "the user id of the file",
            required: true
        },
        mimeType: {
            type: "string",
            description: "the mime type of the file",
            required: true
        }
    },
    handler: async ({ name, userId, mimeType }) => {
        const file: File = { name, userId, mimeType }
        const addedFile = await addFile(file)
        return addedFile
    }
})

registerFunctionIntoAI({
    name: "remove_file",
    description: "removes a file by id",
    parameters: {
        fileId: {
            type: "number",
            description: "a file id",
            required: true
        }
    },
    handler: async ({ fileId }) => {
        const removedFile = await removeFile(fileId)
        return removedFile
    }
})

// Uncommented and converted update_file function
registerFunctionIntoAI({
    name: "update_file",
    description: "update a file by id",
    parameters: {
        fileId: {
            type: "number",
            description: "a file id",
            required: true
        },
        name: {
            type: "string",
            description: "the name of the file",
            required: true
        },
        userId: {
            type: "number",
            description: "the user id of the file",
            required: true
        },
        mimeType: {
            type: "string",
            description: "the mime type of the file",
            required: true
        }
    },
    handler: async ({ fileId, name, userId, mimeType }) => {
        const file: File = { name, userId, mimeType }
        const updatedFile = await updateFile(fileId, file)
        return updatedFile
    }
})
