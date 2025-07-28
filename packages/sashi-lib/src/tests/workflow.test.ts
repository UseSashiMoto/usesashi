import express from 'express';
import supertest from 'supertest';
import { createMiddleware } from '../middleware';

// Mock all external dependencies
jest.mock('@openai/agents', () => ({
    Agent: jest.fn(),
    run: jest.fn(),
    tool: jest.fn(),
    handoff: jest.fn(),
    setDefaultOpenAIKey: jest.fn().mockImplementation((key) => {
        if (!key || (typeof key === 'string' && key.trim() === '')) {
            throw new Error('Invalid API key');
        }
        return true;
    })
}));

jest.mock('../sashiagent', () => ({
    getSashiAgent: jest.fn(() => ({
        processRequest: jest.fn().mockResolvedValue({
            type: 'general',
            content: 'Test connection successful'
        })
    }))
}));

// Define mock function type
type MockFunction = jest.Mock<Promise<any>, [string, Record<string, any>]>;

// Mock dependencies specifically to test parameter passing
jest.mock('../ai-function-loader', () => {
    // Create a mock function to track calls and parameters
    const mockCallFunction: MockFunction = jest.fn();
    const functionRegistry = new Map();
    const functionAttributes = new Map();

    // Create mock function objects with getParams method
    const getUserById = {
        _name: 'get_user_by_id',
        _description: 'Get user information',
        _needsConfirmation: false,
        _params: [{ name: 'userId', type: 'string', description: 'ID of the user to retrieve' }],
        getName: function () { return this._name; },
        getDescription: function () { return this._description; },
        getNeedsConfirm: function () { return this._needsConfirmation; },
        getParams: function () { return this._params; },
        description: function () {
            return {
                type: 'function',
                function: {
                    name: this._name,
                    description: this._description,
                    parameters: {
                        type: 'object',
                        properties: {
                            userId: {
                                type: 'string',
                                description: 'ID of the user to retrieve'
                            }
                        },
                        required: ['userId']
                    }
                }
            };
        }
    };

    const getFilesByUserId = {
        _name: 'get_file_by_user_id',
        _description: 'Get all files of the user',
        _needsConfirmation: false,
        _params: [{ name: 'userId', type: 'string', description: 'ID of the user whose files to retrieve' }],
        getName: function () { return this._name; },
        getDescription: function () { return this._description; },
        getNeedsConfirm: function () { return this._needsConfirmation; },
        getParams: function () { return this._params; },
        description: function () {
            return {
                type: 'function',
                function: {
                    name: this._name,
                    description: this._description,
                    parameters: {
                        type: 'object',
                        properties: {
                            userId: {
                                type: 'string',
                                description: 'ID of the user whose files to retrieve'
                            }
                        },
                        required: ['userId']
                    }
                }
            };
        }
    };

    // Add functions to the registry
    functionRegistry.set('get_user_by_id', getUserById);
    functionRegistry.set('get_file_by_user_id', getFilesByUserId);

    // Implementation of callFunctionFromRegistryFromObject that records calls
    mockCallFunction.mockImplementation(async (name: string, params: Record<string, any>) => {
        if (name === 'get_user_by_id') {
            // Validate params
            if (!params.userId || typeof params.userId !== 'string') {
                throw new Error('Invalid userId parameter');
            }

            // Mock user logic
            const { userId } = params;
            const user = users.find(u => u.userId === userId);
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }
            return user;
        } else if (name === 'get_file_by_user_id') {
            // Validate params - must have userId and must be string
            if (!params.userId || typeof params.userId !== 'string') {
                throw new Error(`Invalid userId parameter: ${JSON.stringify(params)}`);
            }

            // Mock files logic
            const { userId } = params;
            const userFiles = files[userId];
            if (!userFiles) {
                throw new Error(`Files for user with ID ${userId} not found`);
            }
            return userFiles;
        } else {
            throw new Error(`Function ${name} not found in registry`);
        }
    });

    return {
        getFunctionRegistry: jest.fn(() => functionRegistry),
        getFunctionAttributes: jest.fn(() => functionAttributes),
        callFunctionFromRegistryFromObject: mockCallFunction
    };
});

// Define user type to match our test data structure
interface User {
    userId: string;
    name: string;
    email?: string;
    profile?: {
        details?: {
            preferredId?: string;
        }
    }
}

// Mock user data
const users: User[] = [
    { userId: '1', name: 'John Doe', email: 'john@example.com' },
    { userId: '2', name: 'Jane Smith', email: 'jane@example.com' },
];

// Mock files data
const files: Record<string, Array<{ fileId: string, filename: string, size: number }>> = {
    '1': [
        { fileId: 'f1', filename: 'document1.pdf', size: 1024 },
        { fileId: 'f2', filename: 'image.jpg', size: 2048 },
    ],
    '2': [
        { fileId: 'f3', filename: 'spreadsheet.xlsx', size: 3072 },
        { fileId: 'f4', filename: 'presentation.pptx', size: 4096 },
    ],
};

describe('Workflow Execution Tests', () => {
    let app: express.Application;
    let request: any; // Using any to avoid type compatibility issues with supertest
    let callFunctionSpy: MockFunction;

    // Mock console methods to prevent test output noise
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    beforeAll(() => {
        // Import the actual module to spy on the function
        const aiLoader = require('../ai-function-loader');
        callFunctionSpy = aiLoader.callFunctionFromRegistryFromObject as MockFunction;

        // Set up Express app with middleware
        app = express();
        const middleware = createMiddleware({
            openAIKey: 'test-key', // Mock key for testing
            apiSecretKey: 'test-secret-key', // Required for middleware validation
            debug: true,
        });
        app.use(middleware);
        request = supertest(app);
    });

    beforeEach(() => {
        // Reset mock before each test
        callFunctionSpy.mockReset();

        // Default mock implementation
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id') {
                const user = users.find(u => u.userId === params.userId);
                if (!user) {
                    throw new Error(`User with ID ${params.userId} not found`);
                }
                return user;
            } else if (name === 'get_file_by_user_id') {
                const userFiles = files[params.userId];
                if (!userFiles) {
                    throw new Error(`Files for user with ID ${params.userId} not found`);
                }
                return userFiles;
            } else {
                throw new Error(`Function ${name} not found in registry`);
            }
        });
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    test('should execute a simple one-function workflow', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id' && params.userId === '1') {
                return users.find(u => u.userId === '1');
            } else {
                throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
            }
        });

        const workflow = {
            "type": "workflow",
            "description": "Get a user by user id",
            "actions": [
                {
                    "id": "getUserById",
                    "tool": "get_user_by_id",
                    "description": "Get a user by their ID",
                    "parameters": {
                        "userId": "1"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "a users id",
                            "required": true
                        }
                    },
                    "map": false
                }
            ],
            "ui": {
                "inputComponents": [
                    {
                        "key": "userInput.userId",
                        "label": "User ID",
                        "type": "string",
                        "required": true
                    }
                ],
                "outputComponents": [
                    {
                        "actionId": "getUserById",
                        "component": "dataCard",
                        "props": {}
                    }
                ]
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('results');
        expect(response.body.results).toHaveLength(1);

        // Check call to function was made with correct parameters
        expect(callFunctionSpy).toHaveBeenCalledTimes(1);
        expect(callFunctionSpy).toHaveBeenCalledWith('get_user_by_id', { userId: '1' });

        // Verify result content
        const result = response.body.results[0];
        expect(result).toHaveProperty('actionId', 'getUserById');
        expect(result).toHaveProperty('result');
        expect(result.result).toHaveProperty('userId', '1');
        expect(result.result).toHaveProperty('name', 'John Doe');
        expect(result.result).toHaveProperty('email', 'john@example.com');
    });

    test('should execute a chained workflow passing data between functions', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        const workflow = {
            "type": "workflow",
            "description": "Get user files",
            "actions": [
                {
                    "id": "get_user",
                    "tool": "get_user_by_id",
                    "description": "Get user information",
                    "parameters": {
                        "userId": "2"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "ID of the user to retrieve",
                            "required": true
                        }
                    },
                    "map": false
                },
                {
                    "id": "get_files",
                    "tool": "get_file_by_user_id",
                    "description": "Get all files of the user",
                    "parameters": {
                        "userId": "get_user.userId"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "ID of the user whose files to retrieve",
                            "required": true
                        }
                    },
                    "map": false
                }
            ],
            "ui": {
                "inputComponents": [
                    {
                        "key": "userInput.userId",
                        "label": "User ID",
                        "type": "string",
                        "required": true
                    }
                ],
                "outputComponents": [
                    {
                        "actionId": "get_user",
                        "component": "dataCard",
                        "props": {}
                    },
                    {
                        "actionId": "get_files",
                        "component": "table",
                        "props": {}
                    }
                ]
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('results');
        expect(response.body.results).toHaveLength(2);

        // Verify function calls made with correct parameters
        expect(callFunctionSpy).toHaveBeenCalledTimes(2);
        expect(callFunctionSpy).toHaveBeenCalledWith('get_user_by_id', { userId: '2' });
        expect(callFunctionSpy).toHaveBeenCalledWith('get_file_by_user_id', { userId: '2' });

        // Verify results
        const userResult = response.body.results.find((r: any) => r.actionId === 'get_user');
        expect(userResult).toBeDefined();
        expect(userResult.result).toHaveProperty('userId', '2');
        expect(userResult.result).toHaveProperty('name', 'Jane Smith');

        const filesResult = response.body.results.find((r: any) => r.actionId === 'get_files');
        expect(filesResult).toBeDefined();
        expect(filesResult.result).toHaveLength(2);
        expect(filesResult.result[0]).toHaveProperty('fileId', 'f3');
    });

    test('should handle errors in workflow execution', async () => {
        const workflow = {
            "type": "workflow",
            "description": "Get non-existent user",
            "actions": [
                {
                    "id": "action1",
                    "tool": "get_user_by_id",
                    "description": "Get user information",
                    "parameters": {
                        "userId": "999"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "ID of the user to retrieve",
                            "required": true
                        }
                    },
                    "map": false
                }
            ],
            "ui": {
                "inputComponents": [
                    {
                        "key": "userInput.userId",
                        "label": "User ID",
                        "type": "string",
                        "required": true
                    }
                ],
                "outputComponents": [
                    {
                        "actionId": "action1",
                        "component": "dataCard",
                        "props": {}
                    }
                ]
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toHaveLength(1);
        expect(response.body.errors[0]).toHaveProperty('actionId', 'action1');
        expect(response.body.errors[0].error).toContain('User with ID 999 not found');
    });

    test('should handle missing function in registry', async () => {
        const workflow = {
            "type": "workflow",
            "description": "Call non-existent function",
            "actions": [
                {
                    "id": "action1",
                    "tool": "non_existent_function",
                    "description": "This function does not exist",
                    "parameters": {},
                    "parameterMetadata": {},
                    "map": false
                }
            ],
            "ui": {
                "inputComponents": [],
                "outputComponents": [
                    {
                        "actionId": "action1",
                        "component": "dataCard",
                        "props": {}
                    }
                ]
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toHaveLength(1);
        expect(response.body.errors[0]).toHaveProperty('actionId', 'action1');
        expect(response.body.errors[0].error).toContain('Function non_existent_function not found');
    });

    test('should handle errors when referenced field does not exist', async () => {
        const workflow = {
            "type": "workflow",
            "description": "Get user with non-existent field reference",
            "actions": [
                {
                    "id": "get_user",
                    "tool": "get_user_by_id",
                    "description": "Get user information",
                    "parameters": {
                        "userId": "1"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "ID of the user to retrieve",
                            "required": true
                        }
                    },
                    "map": false
                },
                {
                    "id": "get_files",
                    "tool": "get_file_by_user_id",
                    "description": "Get all files of the user",
                    "parameters": {
                        "userId": "get_user.non_existent_field"
                    },
                    "parameterMetadata": {
                        "userId": {
                            "type": "string",
                            "description": "ID of the user whose files to retrieve",
                            "required": true
                        }
                    },
                    "map": false
                }
            ],
            "ui": {
                "inputComponents": [
                    {
                        "key": "userInput.userId",
                        "label": "User ID",
                        "type": "string",
                        "required": true
                    }
                ],
                "outputComponents": [
                    {
                        "actionId": "get_user",
                        "component": "dataCard",
                        "props": {}
                    },
                    {
                        "actionId": "get_files",
                        "component": "table",
                        "props": {}
                    }
                ]
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toHaveLength(1);
        expect(response.body.errors[0]).toHaveProperty('actionId', 'get_files');
        expect(response.body.errors[0].error).toContain('Files for user with ID undefined not found');
    });
}); 