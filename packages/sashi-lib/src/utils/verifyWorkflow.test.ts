import { AIFieldEnum, AIFunction, AIObject } from '../ai-function-loader';
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

    describe('action reference validation', () => {
        it('should reject workflow with reference to non-existent action', () => {
            const workflow = {
                type: 'workflow',
                description: 'Invalid action reference',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user',
                        parameters: { userId: 123 }
                    },
                    {
                        id: 'get_files',
                        tool: 'get_files_by_user',
                        description: 'Get files',
                        parameters: { userId: 'nonexistent_action.id' }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('references non-existent action "nonexistent_action"');
        });

        it('should reject workflow with forward reference', () => {
            const workflow = {
                type: 'workflow',
                description: 'Forward reference',
                actions: [
                    {
                        id: 'get_files',
                        tool: 'get_files_by_user',
                        description: 'Get files',
                        parameters: { userId: 'get_user.id' }
                    },
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user',
                        parameters: { userId: 123 }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('cannot reference action "get_user" that comes after it');
        });

        it('should reject workflow with reference to non-existent field', () => {
            // Add return type to mock function
            const mockWithReturn = new AIFunction('get_user_by_id', 'Get user')
                .args({ name: 'userId', type: 'number', description: 'User ID', required: true })
                .returns(new AIObject('User', 'User object', true)
                    .field({ name: 'id', type: 'number', description: 'User ID', required: true })
                    .field({ name: 'name', type: 'string', description: 'User name', required: true })
                )
                .implement(() => ({ id: 1, name: 'Test' }));

            const registry = require('../ai-function-loader').getFunctionRegistry();
            registry.set('get_user_by_id', mockWithReturn);

            const workflow = {
                type: 'workflow',
                description: 'Invalid field reference',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user',
                        parameters: { userId: 123 }
                    },
                    {
                        id: 'get_files',
                        tool: 'get_files_by_user',
                        description: 'Get files',
                        parameters: { userId: 'get_user.nonexistent_field' }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('field "nonexistent_field" that does not exist');
            expect(result.errors[0]).toContain('Available fields: id, name');
        });

        it('should accept workflow with valid action reference', () => {
            // Add return type to mock function
            const mockWithReturn = new AIFunction('get_user_by_id', 'Get user')
                .args({ name: 'userId', type: 'number', description: 'User ID', required: true })
                .returns(new AIObject('User', 'User object', true)
                    .field({ name: 'id', type: 'number', description: 'User ID', required: true })
                    .field({ name: 'name', type: 'string', description: 'User name', required: true })
                )
                .implement(() => ({ id: 1, name: 'Test' }));

            const registry = require('../ai-function-loader').getFunctionRegistry();
            registry.set('get_user_by_id', mockWithReturn);

            const workflow = {
                type: 'workflow',
                description: 'Valid action reference',
                actions: [
                    {
                        id: 'get_user',
                        tool: 'get_user_by_id',
                        description: 'Fetch user',
                        parameters: { userId: 123 }
                    },
                    {
                        id: 'get_files',
                        tool: 'get_files_by_user',
                        description: 'Get files',
                        parameters: { userId: 'get_user.id' }
                    }
                ]
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept userInput references without validation', () => {
            const workflow = {
                type: 'workflow',
                description: 'UserInput reference',
                actions: [
                    {
                        id: 'create_user',
                        tool: 'create_user',
                        description: 'Create user',
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

        it('should reproduce the survey bug - referencing .id instead of .surveyId', () => {
            // Simulate the actual survey functions
            const createSurveyFn = new AIFunction('create_survey', 'Create survey')
                .args(
                    { name: 'title', type: 'string', description: 'Title', required: true },
                    { name: 'subtitle', type: 'string', description: 'Subtitle', required: true }
                )
                .returns(new AIObject('SurveyResult', 'Survey result', true)
                    .field({ name: 'success', type: 'boolean', description: 'Success', required: true })
                    .field({ name: 'message', type: 'string', description: 'Message', required: true })
                    .field({ name: 'surveyId', type: 'string', description: 'Survey ID', required: false })
                )
                .implement(() => ({ success: true, message: 'Created', surveyId: 'survey_123' }));

            const addQuestionFn = new AIFunction('add_question', 'Add question')
                .args(
                    { name: 'surveyId', type: 'string', description: 'Survey ID', required: true },
                    { name: 'questionText', type: 'string', description: 'Question', required: true },
                    { name: 'answerOptions', type: 'string', description: 'Answers', required: true }
                )
                .implement(() => ({ success: true }));

            const registry = require('../ai-function-loader').getFunctionRegistry();
            registry.set('create_survey', createSurveyFn);
            registry.set('add_question', addQuestionFn);

            const workflowWithBug = {
                type: 'workflow',
                description: 'Create survey with question',
                actions: [
                    {
                        id: 'createSurvey',
                        tool: 'create_survey',
                        parameters: { title: 'Test', subtitle: 'Test Subtitle' }
                    },
                    {
                        id: 'addQuestion',
                        tool: 'add_question',
                        parameters: {
                            surveyId: 'createSurvey.id', // BUG: should be .surveyId
                            questionText: 'Question 1',
                            answerOptions: 'Yes, No'
                        }
                    }
                ]
            };

            const result = verifyWorkflow(workflowWithBug);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('field "id" that does not exist');
            expect(result.errors[0]).toContain('Available fields: success, message, surveyId');
        });
    });

    describe('array input type validation', () => {
        it('should accept array type with valid subFields', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test array input',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'name',
                                    label: 'Name',
                                    type: 'string',
                                    required: true
                                },
                                {
                                    key: 'count',
                                    label: 'Count',
                                    type: 'number',
                                    required: false
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject array type without subFields', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test array input',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('array') && e.includes('subFields'))).toBe(true);
        });

        it('should reject array type with empty subFields', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test array input',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: []
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('array') && e.includes('subFields'))).toBe(true);
        });

        it('should validate nested arrays', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test nested array input',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.sections',
                            label: 'Sections',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'title',
                                    label: 'Section Title',
                                    type: 'string',
                                    required: true
                                },
                                {
                                    key: 'items',
                                    label: 'Items',
                                    type: 'array',
                                    required: true,
                                    subFields: [
                                        {
                                            key: 'itemName',
                                            label: 'Item Name',
                                            type: 'string',
                                            required: true
                                        },
                                        {
                                            key: 'quantity',
                                            label: 'Quantity',
                                            type: 'number',
                                            required: false
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject nested array without subFields', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test nested array input',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.sections',
                            label: 'Sections',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'title',
                                    label: 'Section Title',
                                    type: 'string',
                                    required: true
                                },
                                {
                                    key: 'items',
                                    label: 'Items',
                                    type: 'array',
                                    required: true
                                    // Missing subFields
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('subFields[1]: type \'array\' requires a non-empty \'subFields\' array'))).toBe(true);
        });

        it('should validate all subField types', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test all subField types',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'stringField',
                                    label: 'String',
                                    type: 'string',
                                    required: true
                                },
                                {
                                    key: 'numberField',
                                    label: 'Number',
                                    type: 'number',
                                    required: true
                                },
                                {
                                    key: 'booleanField',
                                    label: 'Boolean',
                                    type: 'boolean',
                                    required: false
                                },
                                {
                                    key: 'enumField',
                                    label: 'Enum',
                                    type: 'enum',
                                    enumValues: ['Option1', 'Option2'],
                                    required: true
                                },
                                {
                                    key: 'textField',
                                    label: 'Text',
                                    type: 'text',
                                    required: false
                                },
                                {
                                    key: 'csvField',
                                    label: 'CSV',
                                    type: 'csv',
                                    expectedColumns: ['col1', 'col2'],
                                    required: false
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject subField with missing key', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test subField validation',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    label: 'Name',
                                    type: 'string',
                                    required: true
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('subFields[0]: Missing or invalid \'key\' field'))).toBe(true);
        });

        it('should reject subField with missing label', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test subField validation',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'name',
                                    type: 'string',
                                    required: true
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('subFields[0]: Missing or invalid \'label\' field'))).toBe(true);
        });

        it('should reject subField with invalid type', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test subField validation',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'name',
                                    label: 'Name',
                                    type: 'invalid_type',
                                    required: true
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('Invalid type \'invalid_type\''))).toBe(true);
        });

        it('should reject enum subField without enumValues', () => {
            const workflow = {
                type: 'workflow',
                description: 'Test subField validation',
                actions: [
                    {
                        id: 'test_action',
                        tool: 'get_user_by_id',
                        parameters: { userId: 123 }
                    }
                ],
                ui: {
                    inputComponents: [
                        {
                            key: 'userInput.items',
                            label: 'Items',
                            type: 'array',
                            required: true,
                            subFields: [
                                {
                                    key: 'status',
                                    label: 'Status',
                                    type: 'enum',
                                    required: true
                                }
                            ]
                        }
                    ],
                    outputComponents: []
                }
            };

            const result = verifyWorkflow(workflow);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('type \'enum\' requires a non-empty \'enumValues\' array'))).toBe(true);
        });
    });
}); 