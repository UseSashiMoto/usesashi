import { describe, expect, it, jest, test } from '@jest/globals';
import axios from 'axios';
import express, { Request, Response } from 'express';
import fetchMock from 'jest-fetch-mock';
import OpenAI from 'openai';
import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';
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
    let request: TestAgent;

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

describe('Workflow Execution', () => {
    let app: express.Application;
    let request: any;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Reset all mocks
        jest.clearAllMocks();

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
        test('should handle array notation in parameter references', async () => {
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

            // Mock the function registry responses
            const mockGetAllUsers = jest.fn<any>().mockResolvedValue([
                { email: 'user1@test.com', name: 'User 1' },
                { email: 'user2@test.com', name: 'User 2' }
            ] as const);

            const mockGetUserFiles = jest.fn<any>().mockImplementation(async (params: { userId: string }) => {
                return { files: [`files for ${params.userId}`] };
            });

            // Mock the function registry
            const mockFunctionRegistry = new Map();
            mockFunctionRegistry.set('get_all_users', {
                getName: () => 'get_all_users',
                getParams: () => [],
                execute: mockGetAllUsers
            });
            mockFunctionRegistry.set('get_user_files', {
                getName: () => 'get_user_files',
                getParams: () => [{ name: 'userId', type: 'string' }],
                execute: mockGetUserFiles
            });

            // Mock the getFunctionRegistry function
            jest.spyOn(require('./ai-function-loader'), 'getFunctionRegistry')
                .mockReturnValue(mockFunctionRegistry);

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
            // Mock the function registry responses
            const mockGetAllUsers = jest.fn<any>().mockResolvedValue([
                { id: 1, name: 'User 1' },
                { id: 2, name: 'User 2' }
            ]);

            const mockProcessUser = jest.fn().mockImplementation(async (params: unknown) => {
                const typedParams = params as { user: { id: number, name: string } };
                return { processed: true, userId: typedParams.user.id };
            });

            // Mock the function registry
            const mockFunctionRegistry = new Map();
            mockFunctionRegistry.set('get_all_users', {
                getName: () => 'get_all_users',
                getParams: () => [],
                execute: mockGetAllUsers
            });
            mockFunctionRegistry.set('process_user', {
                getName: () => 'process_user',
                getParams: () => [{ name: 'user', type: 'object' }],
                execute: mockProcessUser
            });

            // Mock the getFunctionRegistry function
            jest.spyOn(require('./ai-function-loader'), 'getFunctionRegistry')
                .mockReturnValue(mockFunctionRegistry);

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

            // Mock the function registry responses
            const mockGetAllUsers = jest.fn<any>().mockResolvedValue([
                { id: 1, name: 'User 1' },
                { id: 2, name: 'User 2' }
            ] as const);

            // Mock the function registry
            const mockFunctionRegistry = new Map();
            mockFunctionRegistry.set('get_all_users', {
                getName: () => 'get_all_users',
                getParams: () => [],
                execute: mockGetAllUsers
            });
            mockFunctionRegistry.set('process_user', {
                getName: () => 'process_user',
                getParams: () => [{ name: 'user', type: 'object' }],
                execute: jest.fn()
            });

            // Mock the getFunctionRegistry function
            jest.spyOn(require('./ai-function-loader'), 'getFunctionRegistry')
                .mockReturnValue(mockFunctionRegistry);

            const response = await request.post('/workflow/execute')
                .send({ workflow, debug: true });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Failed to execute workflow');
            expect(response.body.stepErrors).toBeDefined();
            expect(response.body.stepErrors.length).toBeGreaterThan(0);
        });
    });
});