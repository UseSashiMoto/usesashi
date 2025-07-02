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

// CSV Processing Functions for testing workflows

// User data validation interface
export interface UserData {
    name: string;
    email: string;
    age: number;
}

// File data interface  
export interface FileData {
    filename: string;
    size: number;
    type: string;
}

// User validation result interface
export interface UserValidationResult {
    name: string;
    email: string;
    age: number;
    isValid: boolean;
    errors: string;
    status: 'valid' | 'invalid' | 'warning';
}

// File processing result interface
export interface FileProcessingResult {
    filename: string;
    size: number;
    type: string;
    category: string;
    sizeCategory: 'small' | 'medium' | 'large' | 'very large';
    recommendations: string;
}

// CSV bulk validation summary
export interface ValidationSummary {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    warningRecords: number;
    errorBreakdown: Record<string, number>;
}

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Helper function to get file category
const getFileCategory = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(lowerType)) return 'Image';
    if (['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(lowerType)) return 'Video';
    if (['mp3', 'wav', 'flac', 'aac'].includes(lowerType)) return 'Audio';
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(lowerType)) return 'Document';
    if (['js', 'ts', 'py', 'html', 'css'].includes(lowerType)) return 'Code';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(lowerType)) return 'Archive';
    return 'Other';
};

// Helper function to get size category
const getSizeCategory = (size: number): 'small' | 'medium' | 'large' | 'very large' => {
    if (size < 100000) return 'small';        // < 100KB
    if (size < 10000000) return 'medium';     // < 10MB
    if (size < 100000000) return 'large';     // < 100MB
    return 'very large';                      // >= 100MB
};

const UserDataObject = new AIObject("UserData", "User information data", true)
    .field({
        name: "name",
        description: "user's full name",
        type: "string",
        required: true
    })
    .field({
        name: "email",
        description: "user's email address",
        type: "string",
        required: true
    })
    .field({
        name: "age",
        description: "user's age in years",
        type: "number",
        required: true
    });

const UserValidationResultObject = new AIObject("UserValidationResult", "User validation result", true)
    .field({
        name: "name",
        description: "user's name",
        type: "string",
        required: true
    })
    .field({
        name: "email",
        description: "user's email",
        type: "string",
        required: true
    })
    .field({
        name: "age",
        description: "user's age",
        type: "number",
        required: true
    })
    .field({
        name: "isValid",
        description: "whether the user data is valid",
        type: "boolean",
        required: true
    })
    .field({
        name: "errors",
        description: "list of validation errors",
        type: "string",
        required: true
    })
    .field({
        name: "status",
        description: "validation status: valid, invalid, or warning",
        type: "string",
        required: true
    });

const FileDataObject = new AIObject("FileData", "File metadata information", true)
    .field({
        name: "filename",
        description: "name of the file",
        type: "string",
        required: true
    })
    .field({
        name: "size",
        description: "file size in bytes",
        type: "number",
        required: true
    })
    .field({
        name: "type",
        description: "file type/extension",
        type: "string",
        required: true
    });

const FileProcessingResultObject = new AIObject("FileProcessingResult", "File processing result", true)
    .field({
        name: "filename",
        description: "name of the file",
        type: "string",
        required: true
    })
    .field({
        name: "size",
        description: "file size in bytes",
        type: "number",
        required: true
    })
    .field({
        name: "type",
        description: "file type/extension",
        type: "string",
        required: true
    })
    .field({
        name: "category",
        description: "file category (Image, Video, Audio, etc.)",
        type: "string",
        required: true
    })
    .field({
        name: "sizeCategory",
        description: "size category: small, medium, large, very large",
        type: "string",
        required: true
    })
    .field({
        name: "recommendations",
        description: "list of recommendations for the file",
        type: "string",
        required: true
    });

const ValidationSummaryObject = new AIObject("ValidationSummary", "Summary of validation results", true)
    .field({
        name: "totalRecords",
        description: "total number of records processed",
        type: "number",
        required: true
    })
    .field({
        name: "validRecords",
        description: "number of valid records",
        type: "number",
        required: true
    })
    .field({
        name: "invalidRecords",
        description: "number of invalid records",
        type: "number",
        required: true
    })
    .field({
        name: "warningRecords",
        description: "number of records with warnings",
        type: "number",
        required: true
    });

// Process single user data with validation
const ProcessUserDataFunction = new AIFunction("ProcessUserDataFunction", "Validates user data including name, email format, and age range")
    .args({
        name: "userData",
        description: "User data to validate",
        type: "object", // Use generic object type to accept CSV data
        required: true
    })
    .returns(UserValidationResultObject)
    .implement(async (userData: any): Promise<UserValidationResult> => {
        console.log("process userData", userData, "type:", typeof userData)
        const errors: string[] = [];
        let status: 'valid' | 'invalid' | 'warning' = 'valid';

        // Validate name
        if (!userData.name || userData.name.trim().length < 2) {
            errors.push("Name must be at least 2 characters long");
        }

        // Validate email
        if (!userData.email || !isValidEmail(userData.email)) {
            errors.push("Invalid email format");
        }

        // Validate age
        if (!userData.age || userData.age < 18 || userData.age > 120) {
            if (userData.age < 18) {
                errors.push("Age must be 18 or older");
            } else if (userData.age > 120) {
                errors.push("Age seems unrealistic (over 120)");
            } else {
                errors.push("Age is required");
            }
        } else if (userData.age > 100) {
            status = 'warning';
            errors.push("Age over 100 - please verify");
        }

        const isValid = errors.length === 0 || status === 'warning';

        if (!isValid) {
            status = 'invalid';
        }

        return {
            name: userData.name,
            email: userData.email,
            age: userData.age,
            isValid,
            errors: errors.join(", "), // Convert array to string
            status
        };
    });

// Process single file data with categorization
const ProcessFileDataFunction = new AIFunction("ProcessFileDataFunction", "Processes file metadata, categorizes files, and provides recommendations")
    .args({
        name: "fileData",
        description: "File data to process",
        type: FileDataObject,
        required: true
    })
    .returns(FileProcessingResultObject)
    .implement(async (fileData: FileData): Promise<FileProcessingResult> => {
        const category = getFileCategory(fileData.type);
        const sizeCategory = getSizeCategory(fileData.size);
        const recommendations: string[] = [];

        // Generate recommendations based on file type and size
        if (sizeCategory === 'very large') {
            recommendations.push("Consider compressing this file to reduce storage usage");
        }

        if (category === 'Image' && sizeCategory === 'large') {
            recommendations.push("Consider optimizing image for web use");
        }

        if (category === 'Video' && sizeCategory === 'very large') {
            recommendations.push("Consider using video compression or streaming");
        }

        if (category === 'Archive') {
            recommendations.push("Verify archive contents and consider extracting if frequently accessed");
        }

        if (category === 'Code') {
            recommendations.push("Ensure code files are backed up and version controlled");
        }

        if (recommendations.length === 0) {
            recommendations.push("File appears to be appropriately sized for its type");
        }

        return {
            filename: fileData.filename,
            size: fileData.size,
            type: fileData.type,
            category,
            sizeCategory,
            recommendations: recommendations.join("; ") // Convert array to string
        };
    });

// Validate single user data (works with map: true)
const ValidateUserFunction = new AIFunction("ValidateUserFunction", "Validates a single user's data including name, email format, and age range")
    .args({
        name: "userData",
        description: "User data to validate",
        type: "object",
        required: true
    })
    .returns(UserValidationResultObject)
    .implement(async (userData: any): Promise<UserValidationResult> => {
        console.log("validate userData", userData, "type:", typeof userData)
        const errors: string[] = [];
        let status: 'valid' | 'invalid' | 'warning' = 'valid';

        // Ensure we have the right data structure
        const name = userData.name || '';
        const email = userData.email || '';
        const age = parseInt(userData.age) || 0;

        // Validate name
        if (!name || name.trim().length < 2) {
            errors.push("Name must be at least 2 characters long");
        }

        // Validate email
        if (!email || !isValidEmail(email)) {
            errors.push("Invalid email format");
        }

        // Validate age
        if (!age || age < 18 || age > 120) {
            if (age < 18) {
                errors.push("Age must be 18 or older");
            } else if (age > 120) {
                errors.push("Age seems unrealistic (over 120)");
            } else {
                errors.push("Age is required");
            }
        } else if (age > 100) {
            status = 'warning';
            errors.push("Age over 100 - please verify");
        }

        const isValid = errors.length === 0 || status === 'warning';

        if (!isValid) {
            status = 'invalid';
        }

        return {
            name,
            email,
            age,
            isValid,
            errors: errors.join(", "), // Convert array to string
            status
        };
    });

// Register the CSV processing functions
registerFunctionIntoAI("ProcessUserDataFunction", ProcessUserDataFunction);
registerFunctionIntoAI("ProcessFileDataFunction", ProcessFileDataFunction);
registerFunctionIntoAI("ValidateUserFunction", ValidateUserFunction);

// Register original file functions
registerFunctionIntoAI("get_file_by_user_id", GetFileByUserIdFunction)
registerFunctionIntoAI("get_file_by_id", GetFileByIdFunction)
registerFunctionIntoAI("remove_file", RemoveFileFunction)
registerFunctionIntoAI("get_file_by_mime_type", GetFileByMimeTypeFunction)
//registerFunctionIntoAI("update_file", UpdateFileFunction)

// Export functions for testing
export { ProcessFileDataFunction, ProcessUserDataFunction, ValidateUserFunction }

