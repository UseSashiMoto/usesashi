import { AIFieldEnum, AIFunction } from './ai-function-loader';
import { SashiAgent, getSashiAgent } from './sashiagent';

// Mock the OpenAI Agents SDK
jest.mock('@openai/agents', () => ({
    Agent: jest.fn().mockImplementation((config) => ({
        name: config.name,
        instructions: config.instructions,
        functions: config.functions
    })),
    run: jest.fn()
}));

// Mock functions for testing
const mockGetUser = new AIFunction('get_user_by_id', 'Get user by ID')
    .args({ name: 'userId', type: 'number', description: 'User ID', required: true })
    .implement(() => ({ id: 1, name: 'Test User' }));

const mockCreateUser = new AIFunction('create_user', 'Create a new user')
    .args(
        { name: 'name', type: 'string', description: 'User name', required: true },
        { name: 'email', type: 'string', description: 'User email', required: true },
        new AIFieldEnum('role', 'User role', ['ADMIN', 'USER'], true)
    )
    .implement(() => ({ id: 2, name: 'New User' }));

describe('SashiAgent with OpenAI Agents SDK', () => {
    let sashiAgent: SashiAgent;
    let mockRun: jest.Mock;

    beforeEach(() => {
        // Clear registry and register test functions
        const registry = new Map();
        jest.spyOn(require('./ai-function-loader'), 'getFunctionRegistry').mockReturnValue(registry);

        registry.set('get_user_by_id', mockGetUser);
        registry.set('create_user', mockCreateUser);

        // Mock the run function
        mockRun = require('@openai/agents').run as jest.Mock;
        mockRun.mockClear();

        sashiAgent = new SashiAgent();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('analyzeRequest', () => {
        it('should identify workflow requests correctly', async () => {
            const workflowRequests = [
                'Get user with ID 123',
                'Create a new user',
                'Show me the files',
                'Find user data',
                'Execute workflow'
            ];

            for (const request of workflowRequests) {
                const result = await sashiAgent['analyzeRequest'](request);
                expect(result).toBe(true);
            }
        });

        it('should identify non-workflow requests correctly', async () => {
            const nonWorkflowRequests = [
                'What is the weather like?',
                'How do I use this application?',
                'Tell me a joke',
                'What time is it?'
            ];

            for (const request of nonWorkflowRequests) {
                const result = await sashiAgent['analyzeRequest'](request);
                expect(result).toBe(false);
            }
        });
    });

    describe('processRequest', () => {
        it('should handle simple conversational requests', async () => {
            mockRun.mockResolvedValue({
                value: {
                    content: 'This is a simple response from the agent.'
                }
            });

            const result = await sashiAgent.processRequest('What is the weather like?');

            expect(result.type).toBe('general');
            expect(result.content).toBe('This is a simple response from the agent.');
            expect(mockRun).toHaveBeenCalledTimes(1);
        });

        it('should handle workflow requests', async () => {
            // Mock the workflow planner response
            mockRun
                .mockResolvedValueOnce({
                    value: {
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
                    }
                })
                // Mock the UI composer response
                .mockResolvedValueOnce({
                    value: {
                        type: 'workflow',
                        description: 'Get user by ID',
                        actions: [
                            {
                                id: 'get_user',
                                tool: 'get_user_by_id',
                                description: 'Fetch user information',
                                parameters: { userId: 123 }
                            }
                        ],
                        ui: {
                            inputComponents: [],
                            outputComponents: [
                                {
                                    actionId: 'get_user',
                                    component: 'dataCard'
                                }
                            ]
                        }
                    }
                })
                // Mock the final response
                .mockResolvedValueOnce({
                    value: {
                        content: 'I\'ve created a workflow to get the user information.'
                    }
                });

            const result = await sashiAgent.processRequest('Get user with ID 123');

            expect(result.type).toBe('general');
            expect(result.content).toContain('I\'ve created a workflow');
            expect(result.content).toContain('```workflow');
            expect(mockRun).toHaveBeenCalledTimes(3); // Planner, UI Composer, Final response
        });

        it('should handle validation errors gracefully', async () => {
            // Mock the workflow planner to return an invalid workflow
            mockRun.mockResolvedValueOnce({
                value: {
                    type: 'workflow',
                    description: 'Invalid workflow',
                    actions: [
                        {
                            id: 'get_user',
                            tool: 'unknown_tool', // This will fail validation
                            description: 'Fetch user information',
                            parameters: {}
                        }
                    ]
                }
            });

            const result = await sashiAgent.processRequest('Get user with ID 123');

            expect(result.type).toBe('general');
            expect(result.content).toContain('some issues');
            expect(result.content).toContain('clarify');
            expect(mockRun).toHaveBeenCalledTimes(1); // Only planner called
        });

        it('should handle agent errors gracefully', async () => {
            mockRun.mockRejectedValue(new Error('Agent service unavailable'));

            const result = await sashiAgent.processRequest('Get user with ID 123');

            expect(result.type).toBe('general');
            expect(result.content).toContain('encountered an error');
        });
    });

    describe('getSashiAgent', () => {
        it('should return a singleton instance', () => {
            const agent1 = getSashiAgent();
            const agent2 = getSashiAgent();

            expect(agent1).toBe(agent2);
        });
    });
}); 