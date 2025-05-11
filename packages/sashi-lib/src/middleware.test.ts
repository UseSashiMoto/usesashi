import { describe, expect, it, jest, test } from '@jest/globals';
import axios from 'axios';
import express from 'express';
import fetchMock from 'jest-fetch-mock';
import OpenAI from 'openai';
import supertest from 'supertest';
import { createMiddleware } from './middleware';


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


    });

    // Adjust the rest of your test cases similarly
});
