import axios from 'axios';
import { handleHubRegistration } from '../src/utils/hub';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock inquirer
jest.mock('inquirer', () => ({
    prompt: jest.fn()
}));
const inquirer = require('inquirer');

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('Hub Registration Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy.mockClear();
        consoleErrorSpy.mockClear();
    });

    describe('handleHubRegistration', () => {
        it('should return null when user skips registration', async () => {
            inquirer.prompt.mockResolvedValueOnce({
                shouldRegister: false
            });

            const result = await handleHubRegistration();

            expect(result).toBeNull();
        });

        it('should successfully complete registration flow', async () => {
            const mockRegistrationData = {
                email: 'test@example.com',
                password: 'password123'
            };

            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce(mockRegistrationData)
                .mockResolvedValueOnce({ wantOptionalFields: false });

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: { id: 'user-123', email: 'test@example.com' },
                    apiKey: 'api-key-123',
                    message: 'Account created successfully'
                }
            });

            const result = await handleHubRegistration();

            expect(result).toBe('api-key-123');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🚀 Registering with Sashi Hub...')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('✅ Registration successful!')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🔑 Your API Key: api-key-123')
            );
        });

        it('should display server connection info when available', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: { id: 'user-123', email: 'test@example.com' },
                    apiKey: 'api-key-123',
                    serverConnection: {
                        id: 'conn-123',
                        name: 'Production Server',
                        url: 'https://api.example.com',
                        apiToken: 'conn-token-123'
                    },
                    message: 'Account created successfully'
                }
            });

            const result = await handleHubRegistration();

            expect(result).toBe('api-key-123');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🌐 Server connection "Production Server" configured')
            );
        });

        it('should display GitHub integration info when available', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: { id: 'user-123', email: 'test@example.com' },
                    apiKey: 'api-key-123',
                    githubConfig: {
                        id: 'github-123',
                        owner: 'testuser',
                        repo: 'testproject',
                        repoName: 'Test Project',
                        defaultBranch: 'main'
                    },
                    message: 'Account created successfully'
                }
            });

            const result = await handleHubRegistration();

            expect(result).toBe('api-key-123');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🐙 GitHub integration configured for testuser/testproject')
            );
        });

        it('should handle registration errors gracefully', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false })
                .mockResolvedValueOnce({ continueWithoutHub: true });

            mockedAxios.post.mockRejectedValueOnce(new Error('Registration failed'));

            const result = await handleHubRegistration();

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ Hub registration failed:'),
                'Registration failed'
            );
        });

        it('should throw error when user cancels after failure', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false })
                .mockResolvedValueOnce({ continueWithoutHub: false });

            mockedAxios.post.mockRejectedValueOnce(new Error('Registration failed'));

            await expect(handleHubRegistration())
                .rejects
                .toThrow('Setup cancelled by user');
        });

        it('should use custom hub URL when provided', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    success: true,
                    user: { id: 'user-123', email: 'test@example.com' },
                    apiKey: 'api-key-123',
                    message: 'Account created successfully'
                }
            });

            const customHubUrl = 'http://localhost:3004';
            const result = await handleHubRegistration({ hubUrl: customHubUrl });

            expect(result).toBe('api-key-123');
            expect(mockedAxios.post).toHaveBeenCalledWith(
                `${customHubUrl}/api/sashi/register`,
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should skip prompts when skipPrompt is true', async () => {
            const result = await handleHubRegistration({ skipPrompt: true });

            expect(result).toBeNull();
            expect(inquirer.prompt).not.toHaveBeenCalled();
        });

        it('should handle network connection errors with custom hub URL', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false })
                .mockResolvedValueOnce({ continueWithoutHub: true });

            const networkError = {
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            };

            mockedAxios.post.mockRejectedValueOnce(networkError);

            const customHubUrl = 'http://localhost:3004';
            const result = await handleHubRegistration({ hubUrl: customHubUrl });

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ Hub registration failed:'),
                `Cannot connect to hub at ${customHubUrl}. Please check the URL or try again later.`
            );
        });
    });
});
