import { AIFieldEnum, AIFunction, registerFunctionIntoAI } from '../ai-function-loader';
import { verifyWorkflow } from './verifyWorkflow';

// Mock functions for testing
const mockGetUser = new AIFunction('get_user_by_id', 'Get user by ID')
    .args({ name: 'userId', type: 'number', description: 'User ID', required: true })
    .implement(() => ({ id: 1, name: 'Test User' }));

const mockGetFiles = new AIFunction('get_files_by_user', 'Get files for user')
    .args({ name: 'userId', type: 'number', description: 'User ID', required: true })
    .implement(() => [{ id: 1, name: 'file1.txt' }]);

const mockCreateUser = new AIFunction('create_user', 'Create a new user')
    .args(
        { name: 'name', type: 'string', description: 'User name', required: true },
        { name: 'email', type: 'string', description: 'User email', required: true },
        new AIFieldEnum('role', 'User role', ['ADMIN', 'USER'], true)
    )
    .implement(() => ({ id: 2, name: 'New User' }));

describe('verifyWorkflow', () => {
    beforeEach(() => {
        // Clear registry before each test
        const registry = new Map();
        jest.spyOn(require('../ai-function-loader'), 'getFunctionRegistry').mockReturnValue(registry);
        
        // Register test functions directly in the mocked registry
        registry.set('get_user_by_id', mockGetUser);
        registry.set('get_files_by_user', mockGetFiles);
        registry.set('create_user', mockCreateUser);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('valid workflows', () => {
        it('should validate a simple workflow with one action', () => {
            const workflow = {
                type: 'workflow',
                description: 'Get user by ID',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: { userId: 123 }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate workflow with userInput placeholders', () => {
            const workflow = {
                type: 'workflow',
                description: 'Create user with form input',
                actions: [
                    {
                        id: 'create_user',
                        tool: 'create_user',
                        description: 'Create new user',
                        parameters: {
                            name: 'userInput.name',
                            email: 'userInput.email',
                            role: 'userInput.role'
                        }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate workflow with action references', () => {
            const workflow = {
                type: 'workflow',
                description: 'Get user and their files',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: { userId: 123 }
                    },
                    {
                        id: 'get_files',
                        tool: 'get_files_by_user',
                        description: 'Get user files',
                        parameters: { userId: 'get_user.id' }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('invalid workflows', () => {
        it('should reject workflow without type', () => {
            const workflow = {
                description: 'Invalid workflow',
                actions: []
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Root object must have type="workflow".');
        });

        it('should reject workflow with wrong type', () => {
            const workflow = {
                type: 'invalid',
                description: 'Invalid workflow',
                actions: []
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Root object must have type="workflow".');
        });

        it('should reject workflow without actions', () => {
            const workflow = {
                type: 'workflow',
                description: 'No actions',
                actions: []
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Workflow must contain a non-empty actions array.');
        });

        it('should reject workflow with missing action id', () => {
            const workflow = {
                type: 'workflow',
                description: 'Missing action id',
                actions: [
                    {
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: { userId: 123 }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Each action must have a string id.');
        });

        it('should reject workflow with duplicate action ids', () => {
            const workflow = {
                type: 'workflow',
                description: 'Duplicate action ids',
                actions: [
                    {
                        id: 'action1',
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: { userId: 123 }
                    },
                    {
                        id: 'action1',
                        tool: 'get_files_by_user',
                        description: 'Get user files',
                        parameters: { userId: 456 }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Duplicate action id: action1');
        });

        it('should reject workflow with unknown tool', () => {
            const workflow = {
                type: 'workflow',
                description: 'Unknown tool',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'unknown_tool',
                        description: 'Fetch user information',
                        parameters: { userId: 123 }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Action #1 (get_user): Unknown tool "unknown_tool".');
        });

        it('should reject workflow with missing required parameter', () => {
            const workflow = {
                type: 'workflow',
                description: 'Missing required parameter',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: {} // Missing userId
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Action #1 (get_user): Missing required parameter "userId" for tool "get_user_by_id".');
        });

        it('should reject workflow with invalid parameter type', () => {
            const workflow = {
                type: 'workflow',
                description: 'Invalid parameter type',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user information',
                        parameters: { userId: 'not_a_number' } // Should be number
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Action #1 (get_user): Parameter "userId" failed validation');
        });

        it('should reject workflow with invalid enum value', () => {
            const workflow = {
                type: 'workflow',
                description: 'Invalid enum value',
                actions: [
                    {
                        id: 'create_user',
                        tool: 'create_user',
                        description: 'Create new user',
                        parameters: {
                            name: 'Test User',
                            email: 'test@example.com',
                            role: 'INVALID_ROLE' // Not in enum
                        }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Action #1 (create_user): Parameter "role" failed validation');
        });
    });

    describe('edge cases', () => {
        it('should handle null/undefined workflow', () => {
            const result = verifyWorkflow(null);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Root object must have type="workflow".');
        });

        it('should handle workflow with null actions', () => {
            const workflow = {
                type: 'workflow',
                description: 'Null actions',
                actions: null
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Workflow must contain a non-empty actions array.');
        });

        it('should allow optional parameters to be missing', () => {
            // Create a function with optional parameter
            const mockOptional = new AIFunction('test_optional', 'Test optional param')
                .args(
                    { name: 'required', type: 'string', description: 'Required param', required: true },
                    { name: 'optional', type: 'string', description: 'Optional param', required: false }
                )
                .implement(() => ({}));

            // Add to the mocked registry
            const registry = require('../ai-function-loader').getFunctionRegistry();
            registry.set('test_optional', mockOptional);

            const workflow = {
                type: 'workflow',
                description: 'Optional parameter missing',
                actions: [
                    {
                        id: 'test',
                        tool: 'test_optional',
                        description: 'Test optional param',
                        parameters: { required: 'value' } // optional param missing
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
}); 