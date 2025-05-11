import { describe, expect, it, jest, test } from '@jest/globals';
import axios from 'axios';
import express, { Request, Response } from 'express';
import fetchMock from 'jest-fetch-mock';
import OpenAI from 'openai';
import supertest from 'supertest';
import { AIFunction, registerFunctionIntoAI } from './ai-function-loader';
import { createMiddleware, validateRepoRequest } from './middleware';


fetchMock.enableMocks(); // Enable fetch mocks

jest.mock('axios');
jest.mock('openai');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('Chat Endpoint', () => {
    let app: express.Application;
    let request: any;
    //let mockFunctionRegistry: Map<string, any>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset function registry mock
        //mockFunctionRegistry = new Map();
        //(getFunctionRegistry as jest.Mock).mockReturnValue(mockFunctionRegistry);

        // Clear all mocks before each test
        jest.clearAllMocks();

        // Mock axios.post
        mockedAxios.post.mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            content: 'Hello, how can I help?',
                            role: 'assistant',
                            refusal: null,
                        },
                    },
                ],
            },
        });

        // Mock OpenAI SDK
        //@ts-ignore
        const mockCreate = jest.fn().mockResolvedValue({
            choices: [
                {
                    message: {
                        content: 'Hello, how can I help?',
                        role: 'assistant',
                        refusal: null,
                    },
                },
            ],
        });

        mockedOpenAI.prototype.chat = {
            completions: {
                create: mockCreate,
            },
        } as any;

        const router = createMiddleware({
            openAIKey: process.env.OPENAI_API_KEY as string,
            useCloud: false, // Change to true if testing cloud route
            sashiServerUrl: 'https://example.com',
            apiSecretKey: 'test-secret-key',
        });

        app.use(router);

        request = supertest(app);

        // Reset and mock fetch
        fetchMock.resetMocks();
        fetchMock.mockResponse(
            JSON.stringify({
                choices: [
                    {
                        message: {
                            content: 'Hello, how can I help?',
                            role: 'assistant',
                            refusal: null,
                        },
                    },
                ],
            })
        );
    });

    describe('/chat/message', () => {
        test('should process a chat message successfully when useCloud is false', async () => {
            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: {
                    content: 'Hello, how can I help?',
                    role: 'assistant',
                    refusal: null,
                },
            });

            // Verify that OpenAI SDK was called
            expect(mockedOpenAI.prototype.chat.completions.create).toHaveBeenCalled();
        });

        test('should process a chat message successfully when useCloud is true', async () => {
            // Change useCloud to true
            const router = createMiddleware({
                openAIKey: process.env.OPENAI_API_KEY as string,
                useCloud: true,
                sashiServerUrl: 'https://example.com',
                apiSecretKey: 'test-secret-key',
            });

            app.use(router);

            // Reset request
            request = supertest(app);

            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: {
                    content: 'Hello, how can I help?',
                    role: 'assistant',
                    refusal: null,
                },
            });

            // Verify that axios.post was called
            expect(fetchMock).toHaveBeenCalled();
        });

        it('should handle errors in message processing', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Chat error'));
            mockedOpenAI.prototype.chat.completions.create.mockRejectedValueOnce(new Error('Chat error'));

            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                message: 'Error processing request',
                error: 'Chat error',
            });
        });

        test('should use local OpenAI instance when useCloud is false', async () => {
            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: {
                    content: 'Hello, how can I help?',
                    role: 'assistant',
                    refusal: null,
                },
            });

            // Verify that OpenAI SDK's chat completion method was called
            expect(mockedOpenAI.prototype.chat.completions.create).toHaveBeenCalled();

            // Verify that the cloud API was not called
            expect(fetchMock).not.toHaveBeenCalled();
        });

        test('should use cloud API when useCloud is true', async () => {
            // Reinitialize the app and router with useCloud set to true
            app = express();
            app.use(express.json());

            const router = createMiddleware({
                openAIKey: process.env.OPENAI_API_KEY as string,
                useCloud: true,
                sashiServerUrl: 'https://example.com',
                apiSecretKey: 'test-secret-key',
                hubUrl: 'https://hub.example.com',
            });
            app.use(router);
            request = supertest(app);

            const response = await request.post('/chat').send({
                type: '/chat/message',
                inquiry: 'Hello',
                previous: [],
            });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                output: {
                    content: 'Hello, how can I help?',
                    role: 'assistant',
                    refusal: null,
                },
            });

            // Verify that the cloud API was called
            expect(fetchMock).toHaveBeenCalled();

            // Verify that the OpenAI SDK was not called directly
            expect(
                mockedOpenAI.prototype.chat.completions.create
            ).not.toHaveBeenCalled();
        });
    });

    // Adjust the rest of your test cases similarly
});

describe('validateRepoRequest Middleware', () => {
    let app: express.Application;
    let request: ReturnType<typeof supertest>;

    beforeEach(() => {
        app = express();

        // Mock sashiServerUrl and repoSecretKey
        const sashiServerUrl = undefined; // Let it be undefined to use req.get('host')
        const repoSecretKey = 'test-repo-secret-key';

        // Apply the middleware to the test app
        app.use(
            validateRepoRequest({ sashiServerUrl, repoSecretKey }),
            (req: Request, res: Response) => {
                res.status(200).json({ message: 'Middleware passed' });
            }
        );

        request = supertest(app);
    });

    it('should handle invalid currentUrl correctly', async () => {
        const invalidCurrentUrl = 'invalid-url';
        // Mock req.get to return invalidCurrentUrl
        jest.spyOn(express.request, 'get').mockImplementation((headerName: string) => {
            if (headerName === 'host') {
                return invalidCurrentUrl;
            }
            return '';
        });

        const response = await request
            .get('/')
            .set('Origin', 'http://example.com')
            .set('x-repo-token', 'test-repo-secret-key');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Middleware passed' });
    });


    it('should allow request to proceed when origin is missing', async () => {
        const response = await request
            .get('/')
            .set('x-repo-token', 'test-repo-secret-key');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Middleware passed' });
    });

    it('should allow request to proceed when origin is an empty string', async () => {
        const response = await request
            .get('/')
            .set('Origin', '')
            .set('x-repo-token', 'test-repo-secret-key');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Middleware passed' });
    });
});

interface MockAIFunction {
    getName: () => string;
    getDescription: () => string;
    getParams: () => any[];
    execute: jest.Mock;
}

describe.skip('Workflow Execution', () => {
    let app: express.Application;
    let request: ReturnType<typeof supertest>;
    let mockFunctionRegistry: Map<string, MockAIFunction>;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset function registry mock
        mockFunctionRegistry = new Map();

        // Mock the function registry before creating middleware
        jest.spyOn(require('./ai-function-loader'), 'getFunctionRegistry')
            .mockReturnValue(mockFunctionRegistry);

        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create middleware after mocking function registry
        const router = createMiddleware({
            openAIKey: process.env.OPENAI_API_KEY as string,
            useCloud: false,
            sashiServerUrl: 'https://example.com',
            apiSecretKey: 'test-secret-key',
        });

        app.use(router);
        request = supertest(app);
    });

    describe('Array and Mapping Support', () => {
        beforeEach(() => {
            // Register common mock functions used across tests
            const get_all_users = new AIFunction('get_all_users', 'Get all users')
                .args()
                .returns({
                    name: 'users',
                    type: 'array',
                    description: 'Array of user objects'
                })
                .implement(async () => {
                    return [
                        { email: 'user1@test.com', name: 'User 1' },
                        { email: 'user2@test.com', name: 'User 2' }
                    ];
                });

            registerFunctionIntoAI('get_all_users', get_all_users);
        });

        test('should handle array notation in parameter references', async () => {
            // Register specific mock for this test
            const get_user_files = new AIFunction('get_user_files', 'Get user files')
                .args({
                    name: 'userId',
                    type: 'string',
                    description: 'User ID to get files for',
                    required: true
                })
                .returns({
                    name: 'files',
                    type: 'object',
                    description: 'Object containing array of files'
                })
                .implement(async (params: { userId: string }) => {
                    return { files: [`files for ${params.userId}`] };
                });

            registerFunctionIntoAI('get_user_files', get_user_files);

            const workflow = {
                actions: [
                    {
                        id: 'get_users',
                        tool: 'get_all_users',
                        parameters: {}
                    },
                    {
                        id: 'get_files',
                        tool: 'get_user_files',
                        parameters: {
                            userId: 'get_users[*].email'
                        }
                    }
                ]
            };

            const response = await request.post('/workflow/execute')
                .send({ workflow, debug: true });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.results).toHaveLength(1);

            // Verify the results contain the mapped files
            const result = response.body.results[0];
            expect(result.result).toHaveProperty('files');
            expect(Array.isArray(result.result.files)).toBe(true);
        });

        test('should handle mapping actions with map: true', async () => {
            // Register specific mock for this test
            const process_user = new AIFunction('process_user', 'Process a user')
                .args({
                    name: 'user',
                    type: 'object',
                    description: 'User object to process',
                    required: true
                })
                .returns({
                    name: 'result',
                    type: 'object',
                    description: 'Processing result'
                })
                .implement(async (params: { user: { email: string, name: string } }) => {
                    return { processed: true, userId: params.user.email };
                });

            registerFunctionIntoAI('process_user', process_user);

            const workflow = {
                actions: [
                    {
                        id: 'get_users',
                        tool: 'get_all_users',
                        parameters: {}
                    },
                    {
                        id: 'process_users',
                        tool: 'process_user',
                        map: true,
                        parameters: {
                            user: 'get_users[*]'
                        }
                    }
                ]
            };

            const response = await request.post('/workflow/execute')
                .send({ workflow, debug: true });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.results).toHaveLength(1);

            // Verify the results contain the mapped processed users
            const result = response.body.results[0];
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result).toHaveLength(2);
            expect(result.result[0]).toHaveProperty('processed', true);
            expect(result.result[1]).toHaveProperty('processed', true);
        });

        test('should handle errors in array mapping', async () => {
            // Register specific mock for this test
            const process_user = new AIFunction('process_user', 'Process a user')
                .args({
                    name: 'user',
                    type: 'object',
                    description: 'User object to process',
                    required: true
                })
                .returns({
                    name: 'result',
                    type: 'object',
                    description: 'Processing result'
                })
                .implement(async () => {
                    throw new Error('Processing failed');
                });

            registerFunctionIntoAI('process_user', process_user);

            const workflow = {
                actions: [
                    {
                        id: 'get_users',
                        tool: 'get_all_users',
                        parameters: {}
                    },
                    {
                        id: 'process_users',
                        tool: 'process_user',
                        map: true,
                        parameters: {
                            user: 'get_users[*].nonexistent'
                        }
                    }
                ]
            };

            const response = await request.post('/workflow/execute')
                .send({ workflow, debug: true });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Failed to execute workflow');
            expect(response.body.stepErrors).toBeDefined();
            expect(response.body.stepErrors.length).toBeGreaterThan(0);
        });
    });
});