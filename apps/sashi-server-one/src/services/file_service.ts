import { AIArray, AIFieldEnum, AIFunction, AIObject, registerFunctionIntoAI } from "@sashimo/lib"
import generateDB from "your-db"
import { Data } from "your-db/lib/types"

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
            userId:0,
            mimeType: "image/png"
        }
    },
    {
        id: 1,
        data: {
            name: "happy face.png",
            userId:0,
            mimeType: "image/png"
        }
    },
    {
        id: 2,
        data: {
            name: "music.mp3",
            userId:0,
            mimeType: "audio/mp3"
        }
    },
    {
        id: 3,
        data: {
            name: "image1.png",
            userId:1,
            mimeType: "image/png"
        }
    },
    {
        id: 4,
        data: {
            name: "happy face1.png",
            userId:1,
            mimeType: "image/png"
        }
    },
    {
        id: 5,
        data: {
            name: "happy face2.png",
            userId:2,
            mimeType: "image/png"
        }
    },
    {
        id: 6,
        data: {
            name: "music2.mp3",
            userId:2,
            mimeType: "audio/mp3"
        }
    },
]

const myDB = generateDB<File>(data)


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


const GetFileByUserIdFunction = new AIFunction("get_file_by_user_id", "gets a file by a user id")
    .args({
        name: "userId",
        description: "a users id",
        type: "number",
        required: true
    })
    .returns(new AIArray("files", "all files", FileObject))
    .implement(async (userId: number) => {
        const files = await getFileByUserId(userId)
        return files.map((file) => file.data)
    })

    const GetFileByMimeTypeFunction = new AIFunction("get_file_by_mime_type", "gets a file by mime type")
        .args(new AIFieldEnum("mimeType", "a file mime type", ["image/png", "audio/mp3"], true))
        .returns(new AIArray("files", "all files", FileObject))
        .implement(async (mimeType: string) => {
            const files = await getFileByMimeType(mimeType)
            return files.map((file) => file.data)
        })
    
    const GetFileByIdFunction = new AIFunction("get_file_by_id", "gets a file by id")
        .args({
            name: "fileId",
            description: "a file id",
            type: "number",
            required: true
        })
        .returns(FileObject)
        .implement(async (fileId: number) => {
            const file = await getFileById(fileId)
            return file
        }).confirmation(true)
        
        const AddFileFunction = new AIFunction("add_file", "adds a file")
            .args({
                name: "file",
                description: "a file",
                type: FileObject,
                required: true
            })
            .returns(FileObject)
            .implement(async (file: File) => {
                const addedFile = await addFile(file)
                return addedFile
            })
            
            const RemoveFileFunction = new AIFunction("remove_file", "removes a file by id")
                .args({
                    name: "fileId",
                    description: "a file id",
                    type: "number",
                    required: true
                })
                .returns(FileObject)
                .implement(async (fileId: number) => {
                    const removedFile = await removeFile(fileId)
                    return removedFile
                })
                
                const UpdateFileFunction = new AIFunction("update_file", "update a file by id")
                    .args({
                        name: "fileId",
                        description: "a file id",
                        type: "number",
                        required: true
                    })
                    .args({
                        name: "file",
                        description: "a file",
                        type: FileObject,
                        required: true
                    })
                    .returns(FileObject)
                    .implement(async (fileId: number, file: File) => {
                        const updatedFile = await updateFile(fileId, file)
                        return updatedFile
                    })
                    
                    registerFunctionIntoAI("get_file_by_user_id", GetFileByUserIdFunction)
                    registerFunctionIntoAI("get_file_by_id", GetFileByIdFunction)
                    registerFunctionIntoAI("remove_file", RemoveFileFunction) 
                    registerFunctionIntoAI("get_file_by_mime_type", GetFileByMimeTypeFunction)
                    //registerFunctionIntoAI("update_file", UpdateFileFunction)
