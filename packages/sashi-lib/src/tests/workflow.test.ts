import express from 'express';
import supertest from 'supertest';
import { createMiddleware } from '../middleware';

// Mock all external dependencies
jest.mock('@openai/agents', () => ({
    Agent: jest.fn(),
    run: jest.fn(),
    tool: jest.fn(),
    handoff: jest.fn()
}));

jest.mock('../sashiagent');

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

    beforeAll(() => {
        // Import the actual module to spy on the function
        const aiLoader = require('../ai-function-loader');
        callFunctionSpy = aiLoader.callFunctionFromRegistryFromObject as MockFunction;

        // Set up Express app with middleware
        app = express();
        const middleware = createMiddleware({
            openAIKey: 'test-key', // Mock key for testing
            debug: true,
        });
        app.use(middleware);
        request = supertest(app);
    });

    beforeEach(() => {
        // Reset mock before each test
        if (callFunctionSpy) {
            callFunctionSpy.mockClear();
        }
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
            type: 'workflow',
            actions: [
                {
                    id: 'action1',
                    tool: 'get_user_by_id',
                    description: 'Get user information',
                    parameters: {
                        userId: '1'
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
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
        expect(result).toHaveProperty('actionId', 'action1');
        expect(result).toHaveProperty('result');
        expect(result.result).toHaveProperty('userId', '1');
        expect(result.result).toHaveProperty('name', 'John Doe');
        expect(result.result).toHaveProperty('email', 'john@example.com');
    });

    test('should execute a chained workflow passing data between functions', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id' && params.userId === '2') {
                return users.find(u => u.userId === '2');
            } else if (name === 'get_file_by_user_id' && params.userId === '2') {
                return files['2'];
            } else {
                throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
            }
        });

        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'get_user',
                    tool: 'get_user_by_id',
                    description: 'Get user information',
                    parameters: {
                        userId: '2'
                    }
                },
                {
                    id: 'get_files',
                    tool: 'get_file_by_user_id',
                    description: 'Get all files of the user',
                    parameters: {
                        userId: 'get_user.userId'
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
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
        expect(response.body.results).toHaveLength(1); // Only the final result is returned

        // Verify function calls made with correct parameters
        expect(callFunctionSpy).toHaveBeenCalledTimes(2);
        expect(callFunctionSpy).toHaveBeenNthCalledWith(1, 'get_user_by_id', { userId: '2' });
        expect(callFunctionSpy).toHaveBeenNthCalledWith(2, 'get_file_by_user_id', { userId: '2' });

        // Verify result content
        const result = response.body.results[0];
        expect(result).toHaveProperty('actionId', 'get_files');
        expect(result).toHaveProperty('result');
        expect(Array.isArray(result.result)).toBe(true);
        expect(result.result).toHaveLength(2);
        expect(result.result[0]).toHaveProperty('fileId', 'f3');
        expect(result.result[1]).toHaveProperty('fileId', 'f4');
    });

    test('should handle deeply nested parameter references', async () => {
        // First, mock the complex user object that will be returned
        const complexUser: User = {
            userId: '3',
            name: 'Complex User',
            profile: {
                details: {
                    preferredId: '2'
                }
            }
        };

        // Add to users array
        users.push(complexUser);

        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id' && params.userId === '3') {
                return complexUser;
            } else if (name === 'get_file_by_user_id' && params.userId === '2') {
                return files['2'];
            } else {
                throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
            }
        });

        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'get_complex_user',
                    tool: 'get_user_by_id',
                    description: 'Get complex user information',
                    parameters: {
                        userId: '3'  // This will return our complex object
                    }
                },
                {
                    id: 'get_files',
                    tool: 'get_file_by_user_id',
                    description: 'Get files using nested property',
                    parameters: {
                        userId: 'get_complex_user.profile.details.preferredId'  // Test deep nesting
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        // Verify function was called with correctly extracted nested parameter
        expect(callFunctionSpy).toHaveBeenCalledTimes(2);
        expect(callFunctionSpy).toHaveBeenNthCalledWith(1, 'get_user_by_id', { userId: '3' });
        expect(callFunctionSpy).toHaveBeenNthCalledWith(2, 'get_file_by_user_id', { userId: '2' });

        // Verify status is 200 success
        expect(response.status).toBe(200);
    });

    test('should handle errors in workflow execution', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id') {
                if (params.userId === '999') {
                    throw new Error(`User with ID ${params.userId} not found`);
                }
            }
            throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
        });

        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'action1',
                    tool: 'get_user_by_id',
                    description: 'Get user information',
                    parameters: {
                        userId: '999' // Non-existent user ID
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Failed to execute workflow');
    });

    test('should handle errors when referenced field does not exist', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test to return a simple user object
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id' && params.userId === '1') {
                return { userId: '1', name: 'Simple User' }; // Object without the non_existent_field
            } else {
                throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
            }
        });

        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'get_user',
                    tool: 'get_user_by_id',
                    description: 'Get user information',
                    parameters: {
                        userId: '1'
                    }
                },
                {
                    id: 'get_files',
                    tool: 'get_file_by_user_id',
                    description: 'Get all files of the user',
                    parameters: {
                        userId: 'get_user.non_existent_field' // Field doesn't exist
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Failed to execute workflow');
        expect(response.body.details).toContain('non_existent_field');
    });

    test('should support debug mode for troubleshooting workflows', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            if (name === 'get_user_by_id' && params.userId === '2') {
                return users.find(u => u.userId === '2');
            } else if (name === 'get_file_by_user_id' && params.userId === '2') {
                return files['2'];
            } else {
                throw new Error(`Unexpected function call: ${name} with params ${JSON.stringify(params)}`);
            }
        });

        // Create a workflow that will be executed with debug mode enabled
        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'get_user',
                    tool: 'get_user_by_id',
                    description: 'Get user information',
                    parameters: {
                        userId: '2'
                    }
                },
                {
                    id: 'get_files',
                    tool: 'get_file_by_user_id',
                    description: 'Get all files of the user',
                    parameters: {
                        userId: 'get_user.userId'
                    }
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
            }
        };

        // Execute with debug flag enabled
        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow, debug: true });

        // The response should still be successful
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);

        // Function was called the expected number of times
        expect(callFunctionSpy).toHaveBeenCalledTimes(2);
        expect(callFunctionSpy).toHaveBeenNthCalledWith(1, 'get_user_by_id', { userId: '2' });
        expect(callFunctionSpy).toHaveBeenNthCalledWith(2, 'get_file_by_user_id', { userId: '2' });
    });

    test('should handle missing function in registry', async () => {
        // Reset mocks before this test
        callFunctionSpy.mockClear();

        // Mock specific behavior for this test
        callFunctionSpy.mockImplementation(async (name: string, params: Record<string, any>) => {
            throw new Error(`Function ${name} not found in registry`);
        });

        const workflow = {
            type: 'workflow',
            actions: [
                {
                    id: 'action1',
                    tool: 'non_existent_function',
                    description: 'This function does not exist',
                    parameters: {}
                }
            ],
            options: {
                execute_immediately: true,
                generate_ui: false
            }
        };

        const response = await request
            .post('/workflow/execute')
            .set('x-sashi-session-token', 'test-session-token')
            .send({ workflow });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Failed to execute workflow');
        expect(response.body.details).toContain('not found in registry');
    });
}); 