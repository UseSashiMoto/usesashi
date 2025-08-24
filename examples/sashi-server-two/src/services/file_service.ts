import {
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// File-related interfaces
interface FileMetadata {
    id: string
    name: string
    size: number
    type: string
    uploadedBy: string
    uploadedAt: string
    lastModified: string
    path: string
    isPublic: boolean
    downloads: number
    tags: string[]
}

interface FileUploadResult {
    success: boolean
    fileId?: string
    error?: string
    url?: string
    metadata?: FileMetadata
}

// Mock file storage
const fileStorage: FileMetadata[] = [
    {
        id: 'file_001',
        name: 'user_manual.pdf',
        size: 2048576,
        type: 'application/pdf',
        uploadedBy: 'john@example.com',
        uploadedAt: '2024-08-01T10:00:00Z',
        lastModified: '2024-08-01T10:00:00Z',
        path: '/documents/user_manual.pdf',
        isPublic: true,
        downloads: 42,
        tags: ['documentation', 'manual', 'user-guide']
    },
    {
        id: 'file_002',
        name: 'company_logo.png',
        size: 45678,
        type: 'image/png',
        uploadedBy: 'sarah@example.com',
        uploadedAt: '2024-08-05T14:30:00Z',
        lastModified: '2024-08-05T14:30:00Z',
        path: '/images/company_logo.png',
        isPublic: true,
        downloads: 156,
        tags: ['logo', 'branding', 'image']
    },
    {
        id: 'file_003',
        name: 'private_document.docx',
        size: 123456,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedBy: 'michael@example.com',
        uploadedAt: '2024-08-10T09:15:00Z',
        lastModified: '2024-08-12T16:45:00Z',
        path: '/private/private_document.docx',
        isPublic: false,
        downloads: 3,
        tags: ['private', 'confidential']
    }
]

// Helper functions
const generateFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileTypeCategory = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf')) return 'document'
    if (mimeType.includes('word') || mimeType.includes('text')) return 'document'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet'
    return 'other'
}

// AI Object definitions
const FileMetadataObject = new AIObject("FileMetadata", "file metadata and information", true)
    .field({
        name: "id",
        description: "unique file identifier",
        type: "string",
        required: true
    })
    .field({
        name: "name",
        description: "original filename",
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
        description: "MIME type of the file",
        type: "string",
        required: true
    })
    .field({
        name: "uploadedBy",
        description: "email of user who uploaded the file",
        type: "string",
        required: true
    })
    .field({
        name: "uploadedAt",
        description: "when the file was uploaded",
        type: "string",
        required: true
    })
    .field({
        name: "lastModified",
        description: "when the file was last modified",
        type: "string",
        required: true
    })
    .field({
        name: "path",
        description: "file path in storage",
        type: "string",
        required: true
    })
    .field({
        name: "isPublic",
        description: "whether the file is publicly accessible",
        type: "boolean",
        required: true
    })
    .field({
        name: "downloads",
        description: "number of times the file has been downloaded",
        type: "number",
        required: true
    })
    .field({
        name: "tags",
        description: "tags associated with the file",
        type: "array",
        required: false
    })

const FileUploadResultObject = new AIObject("FileUploadResult", "result of file upload operation", true)
    .field({
        name: "success",
        description: "whether the upload was successful",
        type: "boolean",
        required: true
    })
    .field({
        name: "fileId",
        description: "unique identifier of uploaded file",
        type: "string",
        required: false
    })
    .field({
        name: "error",
        description: "error message if upload failed",
        type: "string",
        required: false
    })
    .field({
        name: "url",
        description: "URL to access the uploaded file",
        type: "string",
        required: false
    })
    .field({
        name: "metadata",
        description: "metadata of the uploaded file",
        type: "object",
        required: false
    })

const FileStatsObject = new AIObject("FileStats", "file system statistics", true)
    .field({
        name: "totalFiles",
        description: "total number of files",
        type: "number",
        required: true
    })
    .field({
        name: "totalSize",
        description: "total size of all files in bytes",
        type: "number",
        required: true
    })
    .field({
        name: "totalSizeFormatted",
        description: "total size formatted as human readable",
        type: "string",
        required: true
    })
    .field({
        name: "publicFiles",
        description: "number of public files",
        type: "number",
        required: true
    })
    .field({
        name: "privateFiles",
        description: "number of private files",
        type: "number",
        required: true
    })
    .field({
        name: "totalDownloads",
        description: "total number of downloads across all files",
        type: "number",
        required: true
    })
    .field({
        name: "byType",
        description: "file count breakdown by type",
        type: "object",
        required: true
    })

// Register all file functions using the new format
registerFunctionIntoAI({
    name: "get_all_files",
    description: "retrieve all files in the system",
    parameters: {},
    handler: async () => {
        return fileStorage
    }
})

registerFunctionIntoAI({
    name: "get_file_by_id",
    description: "retrieve a specific file by its ID",
    parameters: {
        fileId: {
            type: "string",
            description: "the unique identifier of the file",
            required: true
        }
    },
    handler: async ({ fileId }) => {
        const file = fileStorage.find(f => f.id === fileId)
        if (!file) {
            throw new Error(`File with ID ${fileId} not found`)
        }
        return file
    }
})

registerFunctionIntoAI({
    name: "search_files",
    description: "search for files by name, type, or tags",
    parameters: {
        query: {
            type: "string",
            description: "search query (searches in filename, type, and tags)",
            required: true
        },
        fileType: {
            type: "string",
            description: "filter by file type category (image, document, video, audio, other)",
            required: false
        },
        isPublic: {
            type: "boolean",
            description: "filter by public/private status",
            required: false
        }
    },
    handler: async ({ query, fileType, isPublic }) => {
        let results = fileStorage.filter(file => {
            const matchesQuery =
                file.name.toLowerCase().includes(query.toLowerCase()) ||
                file.type.toLowerCase().includes(query.toLowerCase()) ||
                file.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))

            const matchesType = !fileType || getFileTypeCategory(file.type) === fileType
            const matchesVisibility = isPublic === undefined || file.isPublic === isPublic

            return matchesQuery && matchesType && matchesVisibility
        })

        return results
    }
})

registerFunctionIntoAI({
    name: "upload_file",
    description: "simulate uploading a new file",
    parameters: {
        filename: {
            type: "string",
            description: "name of the file to upload",
            required: true
        },
        fileType: {
            type: "string",
            description: "MIME type of the file",
            required: true
        },
        size: {
            type: "number",
            description: "size of the file in bytes",
            required: true
        },
        uploadedBy: {
            type: "string",
            description: "email of the user uploading the file",
            required: true
        },
        isPublic: {
            type: "boolean",
            description: "whether the file should be publicly accessible",
            required: false
        },
        tags: {
            type: "string",
            description: "comma-separated tags for the file",
            required: false
        }
    },
    handler: async ({ filename, fileType, size, uploadedBy, isPublic = true, tags = "" }) => {
        const fileId = generateFileId()
        const timestamp = new Date().toISOString()

        // Validate inputs
        if (!filename || filename.trim().length === 0) {
            return {
                success: false,
                error: "Filename cannot be empty"
            }
        }

        if (size <= 0) {
            return {
                success: false,
                error: "File size must be greater than 0"
            }
        }

        if (size > 100 * 1024 * 1024) { // 100MB limit
            return {
                success: false,
                error: "File size exceeds maximum limit of 100MB"
            }
        }

        // Check if file already exists
        const existingFile = fileStorage.find(f => f.name === filename && f.uploadedBy === uploadedBy)
        if (existingFile) {
            return {
                success: false,
                error: "A file with this name already exists for this user"
            }
        }

        // Process tags
        const fileTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : []

        // Create file metadata
        const metadata: FileMetadata = {
            id: fileId,
            name: filename,
            size,
            type: fileType,
            uploadedBy,
            uploadedAt: timestamp,
            lastModified: timestamp,
            path: `/${isPublic ? 'public' : 'private'}/${filename}`,
            isPublic,
            downloads: 0,
            tags: fileTags
        }

        // Simulate upload success/failure (95% success rate)
        const uploadSuccess = Math.random() > 0.05

        if (uploadSuccess) {
            fileStorage.push(metadata)

            console.log('📁 [File Service] File uploaded:', {
                id: fileId,
                name: filename,
                size: formatFileSize(size),
                type: fileType,
                uploadedBy,
                isPublic
            })

            return {
                success: true,
                fileId,
                url: `https://files.example.com${metadata.path}`,
                metadata
            }
        } else {
            return {
                success: false,
                error: "Upload failed due to server error"
            }
        }
    }
})

registerFunctionIntoAI({
    name: "delete_file",
    description: "delete a file from the system",
    parameters: {
        fileId: {
            type: "string",
            description: "the unique identifier of the file to delete",
            required: true
        }
    },
    handler: async ({ fileId }) => {
        const fileIndex = fileStorage.findIndex(f => f.id === fileId)

        if (fileIndex === -1) {
            return {
                success: false,
                message: `File with ID ${fileId} not found`
            }
        }

        const file = fileStorage[fileIndex]!
        fileStorage.splice(fileIndex, 1)

        console.log('🗑️ [File Service] File deleted:', {
            id: fileId,
            name: file.name,
            uploadedBy: file.uploadedBy
        })

        return {
            success: true,
            message: `File '${file.name}' has been deleted successfully`
        }
    }
})

registerFunctionIntoAI({
    name: "get_file_stats",
    description: "get comprehensive file system statistics",
    parameters: {},
    handler: async () => {
        const totalFiles = fileStorage.length
        const totalSize = fileStorage.reduce((sum, file) => sum + file.size, 0)
        const publicFiles = fileStorage.filter(f => f.isPublic).length
        const privateFiles = fileStorage.filter(f => !f.isPublic).length
        const totalDownloads = fileStorage.reduce((sum, file) => sum + file.downloads, 0)

        // Group by file type category
        const byType = fileStorage.reduce((acc, file) => {
            const category = getFileTypeCategory(file.type)
            acc[category] = (acc[category] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        return {
            totalFiles,
            totalSize,
            totalSizeFormatted: formatFileSize(totalSize),
            publicFiles,
            privateFiles,
            totalDownloads,
            byType
        }
    }
})

registerFunctionIntoAI({
    name: "update_file_metadata",
    description: "update file metadata and tags",
    parameters: {
        fileId: {
            type: "string",
            description: "the unique identifier of the file",
            required: true
        },
        isPublic: {
            type: "boolean",
            description: "whether the file should be public",
            required: false
        },
        tags: {
            type: "string",
            description: "comma-separated tags for the file",
            required: false
        }
    },
    handler: async ({ fileId, isPublic, tags }) => {
        const file = fileStorage.find(f => f.id === fileId)

        if (!file) {
            throw new Error(`File with ID ${fileId} not found`)
        }

        // Update fields if provided
        if (isPublic !== undefined) {
            file.isPublic = isPublic
            file.path = file.path.replace(/^\/(public|private)\//, `/${isPublic ? 'public' : 'private'}/`)
        }

        if (tags !== undefined) {
            file.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : []
        }

        file.lastModified = new Date().toISOString()

        console.log('✏️ [File Service] File metadata updated:', {
            id: fileId,
            name: file.name,
            isPublic: file.isPublic,
            tags: file.tags
        })

        return file
    }
})