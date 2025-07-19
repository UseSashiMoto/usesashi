import { describe, expect, it } from '@jest/globals';
import { WorkflowResponse } from '../models/payload';
import {
    analyzeWorkflowCharacteristics,
    detectWorkflowEntryType,
    extractWorkflowFromNested,
    getClassificationExplanation,
    hasEmbeddedWorkflows,
    isErrorResult,
    isPlaceholderValue,
    parseEmbeddedWorkflows,
    removeWorkflowBlocks,
    WorkflowCharacteristics,
    WorkflowClassificationResult
} from '../utils/workflowClassification';

describe('Workflow Classification System', () => {

    describe('isPlaceholderValue', () => {
        it('should detect angle bracket placeholders', () => {
            expect(isPlaceholderValue('<userID>')).toBe(true);
            expect(isPlaceholderValue('<user_id>')).toBe(true);
            expect(isPlaceholderValue('<placeholder>')).toBe(true);
            expect(isPlaceholderValue('<SOMETHING>')).toBe(true);
        });

        it('should detect TODO placeholders', () => {
            expect(isPlaceholderValue('TODO: fill this')).toBe(true);
            expect(isPlaceholderValue('todo: something')).toBe(true);
            expect(isPlaceholderValue('TODO')).toBe(true);
        });

        it('should detect PLACEHOLDER patterns', () => {
            expect(isPlaceholderValue('PLACEHOLDER value')).toBe(true);
            expect(isPlaceholderValue('placeholder text')).toBe(true);
            expect(isPlaceholderValue('PLACEHOLDER')).toBe(true);
        });

        it('should detect template literal patterns', () => {
            expect(isPlaceholderValue('{{placeholder}}')).toBe(true);
            expect(isPlaceholderValue('${placeholder}')).toBe(true);
            expect(isPlaceholderValue('{{user.id}}')).toBe(true);
        });

        it('should detect FILL_IN and ENTER_ patterns', () => {
            expect(isPlaceholderValue('FILL_IN_VALUE')).toBe(true);
            expect(isPlaceholderValue('ENTER_USERNAME')).toBe(true);
            expect(isPlaceholderValue('fill_in something')).toBe(true);
        });

        it('should not detect regular values', () => {
            expect(isPlaceholderValue('john@example.com')).toBe(false);
            expect(isPlaceholderValue('123')).toBe(false);
            expect(isPlaceholderValue('regular text')).toBe(false);
            expect(isPlaceholderValue('user.id')).toBe(false);
            expect(isPlaceholderValue('https://example.com')).toBe(false);
        });

        it('should handle empty and whitespace strings', () => {
            expect(isPlaceholderValue('')).toBe(false);
            expect(isPlaceholderValue('   ')).toBe(false);
            expect(isPlaceholderValue('  <placeholder>  ')).toBe(true); // should trim whitespace
        });
    });

    describe('isErrorResult', () => {
        it('should detect error messages in result values', () => {
            const errorResult = {
                result: {
                    value: 'There was an issue with the parameters you provided'
                }
            };
            expect(isErrorResult(errorResult)).toBe(true);
        });

        it('should detect various error patterns', () => {
            const patterns = [
                'Error: Something went wrong',
                'Failed to execute',
                'Expected number, received string',
                'An error occurred'
            ];

            patterns.forEach(errorMessage => {
                expect(isErrorResult({ result: { value: errorMessage } })).toBe(true);
            });
        });

        it('should not detect success messages as errors', () => {
            const successResult = {
                result: {
                    value: 'Operation completed successfully'
                }
            };
            expect(isErrorResult(successResult)).toBe(false);
        });

        it('should handle null and undefined results', () => {
            expect(isErrorResult(null)).toBe(false);
            expect(isErrorResult(undefined)).toBe(false);
            expect(isErrorResult({ result: null })).toBe(false);
            expect(isErrorResult({ result: undefined })).toBe(false);
        });

        it('should handle non-string result values', () => {
            expect(isErrorResult({ result: { value: 123 } })).toBe(false);
            expect(isErrorResult({ result: { value: { data: 'test' } } })).toBe(false);
        });
    });

    describe('analyzeWorkflowCharacteristics', () => {
        it('should identify query workflows', () => {
            const queryWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'get_users',
                        tool: 'get_users',
                        description: 'Fetch all users from database',
                        parameters: {}
                    }
                ],
                options: { execute_immediately: true, generate_ui: false }
            };

            const characteristics = analyzeWorkflowCharacteristics(queryWorkflow);
            expect(characteristics.isDataQuery).toBe(true);
            expect(characteristics.isMutation).toBe(false);
        });

        it('should identify mutation workflows', () => {
            const mutationWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'create_user',
                        tool: 'create_user',
                        description: 'Create a new user account',
                        parameters: { name: 'John', email: 'john@example.com' }
                    }
                ],
                options: { execute_immediately: false, generate_ui: true }
            };

            const characteristics = analyzeWorkflowCharacteristics(mutationWorkflow);
            expect(characteristics.isMutation).toBe(true);
            expect(characteristics.isDataQuery).toBe(false);
        });

        it('should detect workflows with unset parameters', () => {
            const workflowWithTodo: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'action1',
                        tool: 'some_function',
                        description: 'Do something',
                        parameters: { param1: 'TODO: fill this' }
                    }
                ],
                options: { execute_immediately: false, generate_ui: false }
            };

            const characteristics = analyzeWorkflowCharacteristics(workflowWithTodo);
            expect(characteristics.requiresExecution).toBe(true);
        });

        it('should identify display-only workflows with results', () => {
            const displayWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'get_data',
                        tool: 'get_data',
                        description: 'Retrieve some data',
                        parameters: {}
                    }
                ],
                options: { execute_immediately: true, generate_ui: false },
                executionResults: [
                    {
                        actionId: 'get_data',
                        result: { data: ['item1', 'item2'] },
                        uiElement: { type: 'result', actionId: 'get_data', tool: 'get_data', content: {} as any }
                    }
                ]
            };

            const characteristics = analyzeWorkflowCharacteristics(displayWorkflow);
            expect(characteristics.hasResults).toBe(true);
            expect(characteristics.isDisplayOnly).toBe(true);
        });
    });

    describe('detectWorkflowEntryType', () => {
        describe('Form workflows', () => {
            it('should detect workflows with userInput. parameters', () => {
                const formWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'create_user',
                            tool: 'create_user',
                            description: 'Create user',
                            parameters: {
                                name: 'userInput.name',
                                email: 'userInput.email'
                            }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: true }
                };

                const result = detectWorkflowEntryType(formWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(2);
                expect(result.payload.fields[0].key).toBe('name');
                expect(result.payload.fields[1].key).toBe('email');
            });

            it('should detect workflows with placeholder parameters (your specific case)', () => {
                const userWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'get_user_info',
                            tool: 'get_user_by_id',
                            description: 'Get user information by user id',
                            parameters: {
                                userId: '<user_id>'
                            },
                            parameterMetadata: {
                                userId: {
                                    type: 'number',
                                    description: 'a users id',
                                    required: true
                                }
                            }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(userWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(1);
                expect(result.payload.fields[0].key).toBe('userId');
                expect(result.payload.fields[0].type).toBe('number');
                expect(result.payload.fields[0].label).toBe('a users id');
                expect(result.payload.fields[0].required).toBe(true);
            });

            it('should detect workflows with missing required parameters', () => {
                const incompleteWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action1',
                            tool: 'some_function',
                            description: 'Do something',
                            parameters: {},
                            parameterMetadata: {
                                requiredParam: {
                                    type: 'string',
                                    description: 'This is required',
                                    required: true
                                }
                            }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(incompleteWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(1);
                expect(result.payload.fields[0].key).toBe('requiredParam');
            });

            it('should handle workflows with mixed parameter types', () => {
                const mixedWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action1',
                            tool: 'complex_function',
                            description: 'Complex operation',
                            parameters: {
                                name: '<name>',
                                age: '<age>',
                                active: '<active>'
                            },
                            parameterMetadata: {
                                name: { type: 'string', description: 'User name', required: true },
                                age: { type: 'number', description: 'User age', required: true },
                                active: { type: 'boolean', description: 'Is user active', required: false }
                            }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(mixedWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(3);

                const nameField = result.payload.fields.find((f: any) => f.key === 'name');
                const ageField = result.payload.fields.find((f: any) => f.key === 'age');
                const activeField = result.payload.fields.find((f: any) => f.key === 'active');

                expect(nameField.type).toBe('string');
                expect(ageField.type).toBe('number');
                expect(activeField.type).toBe('boolean');
                expect(activeField.required).toBe(false);
            });

            it('should handle workflows with enum parameters (select dropdowns)', () => {
                const enumWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'change_user_type',
                            tool: 'change_user_type',
                            description: 'Change the type of a user',
                            parameters: {
                                userId: '<user_id>',
                                type: '<new_type>'
                            },
                            parameterMetadata: {
                                userId: {
                                    type: 'string',
                                    description: 'a users id',
                                    required: true
                                },
                                type: {
                                    type: 'string',
                                    description: 'the type to change the user to',
                                    enum: ['CASE_MANAGER', 'COMMUNITY_ENGAGEMENT'],
                                    required: true
                                }
                            }
                        } as any
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(enumWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(2);

                const userIdField = result.payload.fields.find((f: any) => f.key === 'userId');
                const typeField = result.payload.fields.find((f: any) => f.key === 'type');

                // userId should be a text input
                expect(userIdField.type).toBe('string');
                expect(userIdField.label).toBe('a users id');
                expect(userIdField.required).toBe(true);
                expect(userIdField.options).toBeUndefined();

                // type should be an enum dropdown
                expect(typeField.type).toBe('enum');
                expect(typeField.label).toBe('the type to change the user to');
                expect(typeField.required).toBe(true);
                expect(typeField.enumValues).toHaveLength(2);
                expect(typeField.enumValues[0]).toBe('CASE_MANAGER');
                expect(typeField.enumValues[1]).toBe('COMMUNITY_ENGAGEMENT');
            });

            it('should handle enum fields with different naming conventions', () => {
                const enumWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'action1',
                            tool: 'test_function',
                            description: 'Test enum handling',
                            parameters: {
                                status: '<status>',
                                priority: '<priority>'
                            },
                            parameterMetadata: {
                                status: {
                                    type: 'string',
                                    description: 'Status of the item',
                                    enum: ['ACTIVE', 'INACTIVE', 'PENDING_REVIEW'],
                                    required: true
                                },
                                priority: {
                                    type: 'string',
                                    description: 'Priority level',
                                    enum: ['low', 'medium', 'high', 'urgent'],
                                    required: true
                                }
                            }
                        } as any
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(enumWorkflow);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(2);

                const statusField = result.payload.fields.find((f: any) => f.key === 'status');
                const priorityField = result.payload.fields.find((f: any) => f.key === 'priority');

                // Check status field enum values
                expect(statusField.type).toBe('enum');
                expect(statusField.enumValues).toHaveLength(3);
                expect(statusField.enumValues[0]).toBe('ACTIVE');
                expect(statusField.enumValues[1]).toBe('INACTIVE');
                expect(statusField.enumValues[2]).toBe('PENDING_REVIEW');

                // Check priority field enum values
                expect(priorityField.type).toBe('enum');
                expect(priorityField.enumValues).toHaveLength(4);
                expect(priorityField.enumValues[0]).toBe('low');
                expect(priorityField.enumValues[1]).toBe('medium');
                expect(priorityField.enumValues[2]).toBe('high');
                expect(priorityField.enumValues[3]).toBe('urgent');
            });

            it('should handle nested workflow structure with enum fields (your specific case)', () => {
                const nestedEnumWorkflow = {
                    output: {
                        type: 'workflow',
                        description: "Change a user's type",
                        actions: [
                            {
                                id: 'change_user_type',
                                tool: 'change_user_type',
                                description: 'Change the type of a user',
                                parameters: {
                                    userId: '<user_id>',
                                    type: '<new_type>'
                                },
                                parameterMetadata: {
                                    userId: {
                                        type: 'string',
                                        description: 'a users id',
                                        required: true
                                    },
                                    type: {
                                        type: 'string',
                                        description: 'the type to change the user to',
                                        enum: ['CASE_MANAGER', 'COMMUNITY_ENGAGEMENT'],
                                        required: true
                                    }
                                },
                                map: false
                            } as any
                        ]
                    }
                };

                // Test extraction
                const extracted = extractWorkflowFromNested(nestedEnumWorkflow);
                expect(extracted).not.toBeNull();

                // Test classification
                const result = detectWorkflowEntryType(extracted!);
                expect(result.entryType).toBe('form');
                expect(result.payload.fields).toHaveLength(2);

                const userIdField = result.payload.fields.find((f: any) => f.key === 'userId');
                const typeField = result.payload.fields.find((f: any) => f.key === 'type');

                // Verify userId is text input
                expect(userIdField.type).toBe('string');
                expect(userIdField.label).toBe('a users id');

                // Verify type is enum dropdown with correct values
                expect(typeField.type).toBe('enum');
                expect(typeField.label).toBe('the type to change the user to');
                expect(typeField.enumValues).toHaveLength(2);
                expect(typeField.enumValues[0]).toBe('CASE_MANAGER');
                expect(typeField.enumValues[1]).toBe('COMMUNITY_ENGAGEMENT');
            });
        });

        describe('Label/Display workflows', () => {
            it('should detect query workflows with successful results', () => {
                const queryWithResults: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'get_users',
                            tool: 'get_users',
                            description: 'Get all users',
                            parameters: {}
                        }
                    ],
                    options: { execute_immediately: true, generate_ui: false },
                    executionResults: [
                        {
                            actionId: 'get_users',
                            result: { users: ['user1', 'user2'] },
                            uiElement: { type: 'result', actionId: 'get_users', tool: 'get_users', content: {} as any }
                        }
                    ]
                };

                const result = detectWorkflowEntryType(queryWithResults);
                expect(result.entryType).toBe('label');
            });

            it('should NOT classify workflows with error results as display', () => {
                const queryWithError: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'get_user',
                            tool: 'get_user_by_id',
                            description: 'Get user',
                            parameters: { userId: '<userID>' }
                        }
                    ],
                    options: { execute_immediately: true, generate_ui: false },
                    executionResults: [
                        {
                            actionId: 'get_user',
                            result: { value: 'There was an issue with the parameters you provided' },
                            uiElement: { type: 'result', actionId: 'get_user', tool: 'get_user_by_id', content: {} as any }
                        }
                    ]
                };

                const result = detectWorkflowEntryType(queryWithError);
                // Should be form because error indicates missing parameters
                expect(result.entryType).toBe('form');
            });
        });

        describe('Button workflows', () => {
            it('should detect simple execution workflows', () => {
                const buttonWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'cleanup',
                            tool: 'cleanup_files',
                            description: 'Clean up old files',
                            parameters: { days: 30 }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(buttonWorkflow);
                expect(result.entryType).toBe('button');
            });

            it('should detect mutation workflows as buttons', () => {
                const mutationWorkflow: WorkflowResponse = {
                    type: 'workflow',
                    actions: [
                        {
                            id: 'delete_user',
                            tool: 'delete_user',
                            description: 'Delete user account',
                            parameters: { userId: '123' }
                        }
                    ],
                    options: { execute_immediately: false, generate_ui: false }
                };

                const result = detectWorkflowEntryType(mutationWorkflow);
                expect(result.entryType).toBe('button');
            });
        });
    });

    describe('extractWorkflowFromNested', () => {
        it('should extract workflow from nested output structure', () => {
            const nestedWorkflow = {
                output: {
                    type: 'workflow',
                    description: 'Get user information',
                    actions: [
                        {
                            id: 'get_user',
                            tool: 'get_user_by_id',
                            description: 'Get user by ID',
                            parameters: { userId: '<user_id>' }
                        }
                    ]
                }
            };

            const extracted = extractWorkflowFromNested(nestedWorkflow);
            expect(extracted).not.toBeNull();
            expect(extracted!.actions).toHaveLength(1);
            expect(extracted!.actions[0].id).toBe('get_user');
        });

        it('should return workflow if already at root level', () => {
            const rootWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'action1',
                        tool: 'some_tool',
                        description: 'Do something',
                        parameters: {}
                    }
                ],
                options: { execute_immediately: false, generate_ui: false }
            };

            const extracted = extractWorkflowFromNested(rootWorkflow);
            expect(extracted).toBe(rootWorkflow);
        });

        it('should return null for invalid structures', () => {
            expect(extractWorkflowFromNested(null)).toBeNull();
            expect(extractWorkflowFromNested(undefined)).toBeNull();
            expect(extractWorkflowFromNested({})).toBeNull();
            expect(extractWorkflowFromNested({ output: {} })).toBeNull();
            expect(extractWorkflowFromNested({ output: { actions: 'not an array' } })).toBeNull();
        });
    });

    describe('getClassificationExplanation', () => {
        it('should provide explanations for form workflows', () => {
            const formResult: WorkflowClassificationResult = { entryType: 'form' };
            const characteristics: WorkflowCharacteristics = {
                isDataQuery: false,
                isMutation: false,
                isDisplayOnly: false,
                requiresExecution: false,
                hasResults: false
            };

            const explanation = getClassificationExplanation(formResult, characteristics);
            expect(explanation).toContain('user input parameters');
        });

        it('should provide explanations for label workflows', () => {
            const labelResult: WorkflowClassificationResult = { entryType: 'label' };
            const characteristics: WorkflowCharacteristics = {
                isDataQuery: true,
                isMutation: false,
                isDisplayOnly: true,
                requiresExecution: false,
                hasResults: true
            };

            const explanation = getClassificationExplanation(labelResult, characteristics);
            expect(explanation).toContain('fetches and displays data');
        });

        it('should provide explanations for button workflows', () => {
            const buttonResult: WorkflowClassificationResult = { entryType: 'button' };
            const characteristics: WorkflowCharacteristics = {
                isDataQuery: false,
                isMutation: true,
                isDisplayOnly: false,
                requiresExecution: true,
                hasResults: false
            };

            const explanation = getClassificationExplanation(buttonResult, characteristics);
            expect(explanation).toContain('actions/mutations');
        });
    });

    describe('Edge cases and real-world scenarios', () => {
        it('should handle your specific nested workflow structure', () => {
            const userWorkflowData = {
                output: {
                    type: "workflow",
                    description: "Get user information and files for a user by user id",
                    actions: [
                        {
                            id: "get_user_info",
                            tool: "get_user_by_id",
                            description: "Get user information by user id",
                            parameters: {
                                userId: "<user_id>"
                            },
                            parameterMetadata: {
                                userId: {
                                    type: "number",
                                    description: "a users id",
                                    required: true
                                }
                            },
                            map: false
                        },
                        {
                            id: "get_user_files",
                            tool: "get_file_by_user_id",
                            description: "Get files for the user",
                            parameters: {
                                userId: "get_user_info.id"
                            },
                            parameterMetadata: {
                                userId: {
                                    type: "number",
                                    description: "a users id",
                                    required: true
                                }
                            },
                            map: false
                        }
                    ]
                }
            };

            // Test extraction
            const extracted = extractWorkflowFromNested(userWorkflowData);
            expect(extracted).not.toBeNull();

            // Test classification
            const result = detectWorkflowEntryType(extracted!);
            expect(result.entryType).toBe('form');
            expect(result.payload.fields).toHaveLength(1);
            expect(result.payload.fields[0].key).toBe('userId');
            expect(result.payload.fields[0].type).toBe('number');
            expect(result.payload.fields[0].label).toBe('a users id');
        });

        it('should handle workflows with complex parameter references', () => {
            const complexWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'action1',
                        tool: 'function1',
                        description: 'First action',
                        parameters: { input: '<value>' },
                        parameterMetadata: {
                            input: { type: 'string', description: 'Input value', required: true }
                        }
                    },
                    {
                        id: 'action2',
                        tool: 'function2',
                        description: 'Second action',
                        parameters: { data: 'action1.result' }
                    }
                ],
                options: { execute_immediately: false, generate_ui: false }
            };

            const result = detectWorkflowEntryType(complexWorkflow);
            expect(result.entryType).toBe('form');
            expect(result.payload.fields).toHaveLength(1);
            expect(result.payload.fields[0].key).toBe('input');
        });

        it('should handle empty workflows gracefully', () => {
            const emptyWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [],
                options: { execute_immediately: false, generate_ui: false }
            };

            const result = detectWorkflowEntryType(emptyWorkflow);
            expect(result.entryType).toBe('button');
        });

        it('should prioritize explicit userInput over metadata requirements', () => {
            const priorityWorkflow: WorkflowResponse = {
                type: 'workflow',
                actions: [
                    {
                        id: 'action1',
                        tool: 'function1',
                        description: 'Test action',
                        parameters: {
                            param1: 'userInput.value',
                            param2: 'some_value'
                        },
                        parameterMetadata: {
                            param2: { type: 'string', description: 'Another param', required: true }
                        }
                    }
                ],
                options: { execute_immediately: false, generate_ui: false }
            };

            const result = detectWorkflowEntryType(priorityWorkflow);
            expect(result.entryType).toBe('form');
            expect(result.payload.fields).toHaveLength(1);
            expect(result.payload.fields[0].key).toBe('value');
        });
    });
});

describe('Embedded Workflow Parsing', () => {
    describe('parseEmbeddedWorkflows', () => {
        it('should parse single embedded workflow from content', () => {
            const content = `Here's a workflow for you:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Get user by ID",
  "actions": [
    {
      "id": "get_user",
      "tool": "get_user_by_id",
      "description": "Fetch user information",
      "parameters": { "userId": 123 },
      "parameterMetadata": { "userId": { "type": "number", "required": true } },
      "map": false
    }
  ]
}
\`\`\`

This will help you retrieve user data.`;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(1);
            expect(workflows[0].type).toBe('workflow');
            expect(workflows[0].description).toBe('Get user by ID');
            expect(workflows[0].actions).toHaveLength(1);
            expect(workflows[0].actions[0].id).toBe('get_user');
            expect(workflows[0].actions[0].tool).toBe('get_user_by_id');
        });

        it('should parse multiple embedded workflows from content', () => {
            const content = `First workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Get user",
  "actions": [{"id": "get_user", "tool": "get_user_by_id", "parameters": {}}]
}
\`\`\`

And here's another:

\`\`\`workflow
{
  "type": "workflow", 
  "description": "Delete user",
  "actions": [{"id": "delete_user", "tool": "delete_user_by_id", "parameters": {}}]
}
\`\`\`

Both workflows are ready.`;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(2);
            expect(workflows[0].description).toBe('Get user');
            expect(workflows[1].description).toBe('Delete user');
        });

        it('should handle case insensitive workflow blocks', () => {
            const content = `\`\`\`WORKFLOW
{
  "type": "workflow",
  "description": "Case insensitive test",
  "actions": []
}
\`\`\``;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(1);
            expect(workflows[0].description).toBe('Case insensitive test');
        });

        it('should return empty array for content without workflows', () => {
            const content = `This is just regular text with some code:

\`\`\`json
{"not": "a workflow"}
\`\`\`

And some more text.`;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(0);
        });

        it('should ignore invalid JSON in workflow blocks', () => {
            const content = `\`\`\`workflow
{invalid json here
\`\`\`

\`\`\`workflow
{
  "type": "workflow",
  "description": "Valid workflow",
  "actions": []
}
\`\`\``;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(1);
            expect(workflows[0].description).toBe('Valid workflow');
        });

        it('should ignore non-workflow objects in workflow blocks', () => {
            const content = `\`\`\`workflow
{
  "type": "not-a-workflow",
  "description": "This is not a workflow",
  "actions": []
}
\`\`\`

\`\`\`workflow
{
  "type": "workflow",
  "description": "This is a workflow",
  "actions": []
}
\`\`\``;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(1);
            expect(workflows[0].description).toBe('This is a workflow');
        });

        it('should handle workflows with complex nested parameters', () => {
            const content = `\`\`\`workflow
{
  "type": "workflow",
  "description": "Complex workflow",
  "actions": [
    {
      "id": "complex_action",
      "tool": "complex_tool",
      "parameters": {
        "nested": {
          "array": [1, 2, 3],
          "object": {"key": "value"}
        }
      },
      "parameterMetadata": {
        "nested": {
          "type": "object",
          "required": true
        }
      },
      "map": false
    }
  ]
}
\`\`\``;

            const workflows = parseEmbeddedWorkflows(content);

            expect(workflows).toHaveLength(1);
            expect(workflows[0].actions[0].parameters.nested.array).toEqual([1, 2, 3]);
            expect(workflows[0].actions[0].parameters.nested.object.key).toBe('value');
        });
    });

    describe('removeWorkflowBlocks', () => {
        it('should remove single workflow block from content', () => {
            const content = `Here's a workflow:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Test workflow",
  "actions": []
}
\`\`\`

This text should remain.`;

            const result = removeWorkflowBlocks(content);

            expect(result).toBe(`Here's a workflow:

This text should remain.`);
        });

        it('should remove multiple workflow blocks from content', () => {
            const content = `First workflow:

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\`

Some text between.

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\`

Final text.`;

            const result = removeWorkflowBlocks(content);

            expect(result).toBe(`First workflow:

Some text between.

Final text.`);
        });

        it('should preserve other code blocks', () => {
            const content = `Here's some code:

\`\`\`javascript
console.log('hello');
\`\`\`

And a workflow:

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\`

And more code:

\`\`\`json
{"data": "value"}
\`\`\``;

            const result = removeWorkflowBlocks(content);

            expect(result).toContain('```javascript');
            expect(result).toContain('```json');
            expect(result).not.toContain('```workflow');
        });

        it('should handle case insensitive workflow blocks', () => {
            const content = `\`\`\`WORKFLOW
{"type": "workflow", "actions": []}
\`\`\`

\`\`\`Workflow
{"type": "workflow", "actions": []}
\`\`\``;

            const result = removeWorkflowBlocks(content);

            expect(result).toBe('');
        });

        it('should return original content if no workflow blocks', () => {
            const content = `This is just regular text with some code:

\`\`\`json
{"not": "a workflow"}
\`\`\`

And some more text.`;

            const result = removeWorkflowBlocks(content);

            expect(result).toBe(content);
        });
    });

    describe('hasEmbeddedWorkflows', () => {
        it('should return true for content with workflow blocks', () => {
            const content = `Text with workflow:

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\``;

            expect(hasEmbeddedWorkflows(content)).toBe(true);
        });

        it('should return true for case insensitive workflow blocks', () => {
            const content = `\`\`\`WORKFLOW
{"type": "workflow", "actions": []}
\`\`\``;

            expect(hasEmbeddedWorkflows(content)).toBe(true);
        });

        it('should return false for content without workflow blocks', () => {
            const content = `Just regular text with code:

\`\`\`json
{"not": "a workflow"}
\`\`\``;

            expect(hasEmbeddedWorkflows(content)).toBe(false);
        });

        it('should return false for empty content', () => {
            expect(hasEmbeddedWorkflows('')).toBe(false);
        });

        it('should return true for multiple workflow blocks', () => {
            const content = `\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\`

\`\`\`workflow
{"type": "workflow", "actions": []}
\`\`\``;

            expect(hasEmbeddedWorkflows(content)).toBe(true);
        });
    });

    describe('Embedded Workflow Integration', () => {
        it('should correctly identify and parse a real-world embedded workflow example', () => {
            const content = `I'll help you change a user's type. Here's a workflow that will handle this:

\`\`\`workflow
{
  "type": "workflow",
  "description": "Change user type",
  "actions": [
    {
      "id": "change_user_type",
      "tool": "change_user_type",
      "description": "Update the user's type",
      "parameters": {
        "userId": "userInput.userId",
        "type": "userInput.type"
      },
      "parameterMetadata": {
        "userId": {
          "type": "string",
          "description": "The user's ID",
          "required": true
        },
        "type": {
          "type": "string",
          "description": "The new user type",
          "enum": ["CASE_MANAGER", "COMMUNITY_ENGAGEMENT"],
          "required": true
        }
      },
      "map": false
    }
  ]
}
\`\`\`

Just fill in the user ID and select the new type from the dropdown, and the system will update the user's role.`;

            // Test parsing
            const workflows = parseEmbeddedWorkflows(content);
            expect(workflows).toHaveLength(1);
            expect(workflows[0].description).toBe('Change user type');
            expect(workflows[0].actions[0].parameterMetadata.type.enum).toEqual(['CASE_MANAGER', 'COMMUNITY_ENGAGEMENT']);

            // Test detection
            expect(hasEmbeddedWorkflows(content)).toBe(true);

            // Test removal
            const textOnly = removeWorkflowBlocks(content);
            expect(textOnly).toContain("I'll help you change a user's type");
            expect(textOnly).toContain("Just fill in the user ID");
            expect(textOnly).not.toContain('```workflow');
        });

        it('should handle edge cases in embedded workflow parsing', () => {
            const edgeCases = [
                // Empty workflow block
                `\`\`\`workflow
\`\`\``,
                // Workflow block with only whitespace
                `\`\`\`workflow
   
\`\`\``,
                // Malformed JSON
                `\`\`\`workflow
{type: "workflow", missing quotes}
\`\`\``,
                // Missing required fields
                `\`\`\`workflow
{
  "type": "workflow"
}
\`\`\``,
            ];

            edgeCases.forEach((content, index) => {
                const workflows = parseEmbeddedWorkflows(content);
                expect(workflows).toHaveLength(0);
                expect(hasEmbeddedWorkflows(content)).toBe(true); // Should detect the block even if invalid
                expect(removeWorkflowBlocks(content)).not.toContain('```workflow```');
            });
        });
    });
}); 