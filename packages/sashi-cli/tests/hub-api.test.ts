import axios from 'axios';
import { HubRegistrationData, HubRegistrationResponse, registerWithHub } from '../src/utils/hub';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Hub API Client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockRegistrationData: HubRegistrationData = {
        email: 'test@example.com',
        password: 'password123'
    };

    const mockSuccessResponse: HubRegistrationResponse = {
        success: true,
        user: {
            id: 'user-123',
            email: 'test@example.com'
        },
        apiKey: 'api-key-123',
        message: 'Account created successfully'
    };

    describe('registerWithHub', () => {
        it('should successfully register a user with minimal data', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: mockSuccessResponse
            });

            const result = await registerWithHub(mockRegistrationData);

            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://hub.usesashi.com/api/sashi/register',
                mockRegistrationData,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            expect(result).toEqual(mockSuccessResponse);
        });

        it('should use custom hub URL when provided', async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: mockSuccessResponse
            });

            const customHubUrl = 'http://localhost:3004';
            await registerWithHub(mockRegistrationData, { hubUrl: customHubUrl });

            expect(mockedAxios.post).toHaveBeenCalledWith(
                `${customHubUrl}/api/sashi/register`,
                mockRegistrationData,
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                })
            );
        });

        it('should handle API error responses', async () => {
            const errorResponse = {
                response: {
                    data: {
                        error: 'User with this email already exists'
                    }
                }
            };

            mockedAxios.post.mockRejectedValueOnce(errorResponse);

            await expect(registerWithHub(mockRegistrationData))
                .rejects
                .toThrow('User with this email already exists');
        });

        it('should handle network connection errors', async () => {
            const networkError = {
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            };

            mockedAxios.post.mockRejectedValueOnce(networkError);

            await expect(registerWithHub(mockRegistrationData))
                .rejects
                .toThrow('Cannot connect to hub at https://hub.usesashi.com. Please check the URL or try again later.');
        });

        it('should handle DNS resolution errors', async () => {
            const dnsError = {
                code: 'ENOTFOUND',
                message: 'Host not found'
            };

            mockedAxios.post.mockRejectedValueOnce(dnsError);

            await expect(registerWithHub(mockRegistrationData))
                .rejects
                .toThrow('Cannot connect to hub at https://hub.usesashi.com. Please check the URL or try again later.');
        });

        it('should register with full configuration', async () => {
            const fullRegistrationData: HubRegistrationData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                serverUrl: 'https://api.example.com',
                connectionName: 'Production Server',
                github: {
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject',
                    repoName: 'Test Project',
                    defaultBranch: 'main'
                }
            };

            const fullResponse: HubRegistrationResponse = {
                ...mockSuccessResponse,
                user: {
                    ...mockSuccessResponse.user,
                    name: 'Test User'
                },
                serverConnection: {
                    id: 'conn-123',
                    name: 'Production Server',
                    url: 'https://api.example.com',
                    apiToken: 'conn-token-123'
                },
                githubConfig: {
                    id: 'github-123',
                    owner: 'testuser',
                    repo: 'testproject',
                    repoName: 'Test Project',
                    defaultBranch: 'main'
                }
            };

            mockedAxios.post.mockResolvedValueOnce({
                data: fullResponse
            });

            const result = await registerWithHub(fullRegistrationData);

            expect(result).toEqual(fullResponse);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://hub.usesashi.com/api/sashi/register',
                fullRegistrationData,
                expect.any(Object)
            );
        });

        it('should handle generic axios errors', async () => {
            const genericError = {
                message: 'Request failed with status code 500'
            };

            mockedAxios.post.mockRejectedValueOnce(genericError);

            await expect(registerWithHub(mockRegistrationData))
                .rejects
                .toThrow('Network error: Request failed with status code 500');
        });

        it('should handle non-axios errors', async () => {
            const nonAxiosError = new Error('Some other error');

            mockedAxios.post.mockRejectedValueOnce(nonAxiosError);

            await expect(registerWithHub(mockRegistrationData))
                .rejects
                .toThrow('Some other error');
        });
    });
});
