import inquirer from 'inquirer';
import { setupCommand } from '../../src/commands/setup';
import { detectProject } from '../../src/utils/detector';
import { handleHubRegistration, validateHubUrl } from '../../src/utils/hub';
import { createConfigFiles } from '../../src/utils/templates';

// Mock all dependencies
jest.mock('../../src/utils/hub');
jest.mock('../../src/utils/detector');
jest.mock('../../src/utils/templates');
jest.mock('inquirer');
jest.mock('execa');
jest.mock('ora', () => {
    const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn().mockReturnThis(),
        fail: jest.fn().mockReturnThis()
    };
    return jest.fn(() => mockSpinner);
});

const mockHandleHubRegistration = handleHubRegistration as jest.MockedFunction<typeof handleHubRegistration>;
const mockValidateHubUrl = validateHubUrl as jest.MockedFunction<typeof validateHubUrl>;
const mockDetectProject = detectProject as jest.MockedFunction<typeof detectProject>;
const mockCreateConfigFiles = createConfigFiles as jest.MockedFunction<typeof createConfigFiles>;
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
});

describe('Setup Command Hub Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy.mockClear();
        consoleErrorSpy.mockClear();

        // Default mocks
        mockDetectProject.mockResolvedValue({
            framework: 'nextjs',
            hasTypeScript: true,
            packageManager: 'npm',
            rootDir: '/test/project'
        });

        mockValidateHubUrl.mockReturnValue(true);
        mockCreateConfigFiles.mockResolvedValue(undefined);
    });

    describe('Hub URL validation', () => {
        it('should validate hub URL and exit on invalid URL', async () => {
            mockValidateHubUrl.mockReturnValue(false);

            await expect(setupCommand({ hubUrl: 'invalid-url' }))
                .rejects
                .toThrow('process.exit called');

            expect(mockValidateHubUrl).toHaveBeenCalledWith('invalid-url');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ Invalid hub URL format')
            );
            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('should accept valid hub URL', async () => {
            mockValidateHubUrl.mockReturnValue(true);
            mockHandleHubRegistration.mockResolvedValue('test-api-key');

            await setupCommand({
                hubUrl: 'https://hub.example.com',
                yes: true
            });

            expect(mockValidateHubUrl).toHaveBeenCalledWith('https://hub.example.com');
            expect(mockExit).not.toHaveBeenCalled();
        });
    });

    describe('Hub registration flow', () => {
        it('should trigger hub registration when no API key provided', async () => {
            mockHandleHubRegistration.mockResolvedValue('hub-api-key-123');

            await setupCommand({ yes: true });

            expect(mockHandleHubRegistration).toHaveBeenCalledWith({
                hubUrl: undefined,
                skipPrompt: true
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🔑 No API key provided. Let\'s try to get one from Sashi Hub!')
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('✅ Using API key from hub registration')
            );
        });

        it('should not trigger hub registration when API key is provided', async () => {
            await setupCommand({
                openAIAPIKey: 'existing-api-key',
                yes: true
            });

            expect(mockHandleHubRegistration).not.toHaveBeenCalled();
            expect(mockCreateConfigFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiKey: 'existing-api-key'
                })
            );
        });

        it('should pass hub URL to registration handler', async () => {
            mockHandleHubRegistration.mockResolvedValue('hub-api-key');

            await setupCommand({
                hubUrl: 'http://localhost:3004',
                yes: true
            });

            expect(mockHandleHubRegistration).toHaveBeenCalledWith({
                hubUrl: 'http://localhost:3004',
                skipPrompt: true
            });
        });

        it('should handle hub registration failure gracefully', async () => {
            mockHandleHubRegistration.mockRejectedValue(new Error('Registration failed'));

            await expect(setupCommand({ yes: true }))
                .rejects
                .toThrow('process.exit called');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('⚠️ Hub registration failed, continuing without it')
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ OpenAI API key is required')
            );

            expect(mockExit).toHaveBeenCalledWith(1);
        });

        it('should continue with setup when hub registration returns null', async () => {
            mockHandleHubRegistration.mockResolvedValue(null);

            await expect(setupCommand({ yes: true }))
                .rejects
                .toThrow('process.exit called');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ OpenAI API key is required')
            );
        });
    });

    describe('Interactive prompts with hub URL validation', () => {
        it('should validate hub URL in interactive mode', async () => {
            mockInquirer.prompt.mockResolvedValueOnce({
                framework: 'nextjs',
                typescript: true,
                apiKey: 'test-key',
                hubUrl: 'https://hub.example.com'
            });

            await setupCommand({});

            const hubUrlPrompt = mockInquirer.prompt.mock.calls[0][0].find(
                (prompt: any) => prompt.name === 'hubUrl'
            );

            expect(hubUrlPrompt.validate('')).toBe(true); // Optional field
            expect(hubUrlPrompt.validate).toBeDefined();
        });

        it('should use hub URL from prompts', async () => {
            mockInquirer.prompt.mockResolvedValueOnce({
                framework: 'nextjs',
                typescript: true,
                apiKey: 'test-key',
                hubUrl: 'https://custom-hub.com'
            });

            await setupCommand({});

            expect(mockCreateConfigFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    hubUrl: 'https://custom-hub.com'
                })
            );
        });
    });

    describe('Configuration file creation', () => {
        it('should pass hub API key to config creation', async () => {
            mockHandleHubRegistration.mockResolvedValue('hub-secret-key');

            await setupCommand({
                hubUrl: 'https://hub.example.com',
                yes: true
            });

            expect(mockCreateConfigFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiKey: 'hub-secret-key',
                    hubUrl: 'https://hub.example.com',
                    hubApiKey: 'hub-secret-key'
                })
            );
        });

        it('should handle undefined hub API key', async () => {
            await setupCommand({
                openAIAPIKey: 'openai-key',
                hubUrl: 'https://hub.example.com',
                yes: true
            });

            expect(mockCreateConfigFiles).toHaveBeenCalledWith(
                expect.objectContaining({
                    apiKey: 'openai-key',
                    hubUrl: 'https://hub.example.com',
                    hubApiKey: undefined
                })
            );
        });
    });

    describe('Error handling', () => {
        it('should provide helpful error message when no API key available', async () => {
            mockHandleHubRegistration.mockResolvedValue(null);

            await expect(setupCommand({ yes: true }))
                .rejects
                .toThrow('process.exit called');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('❌ OpenAI API key is required')
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('You can either:')
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('1. Provide an OpenAI API key directly')
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('2. Register with Sashi Hub to get an API key')
            );
        });
    });
});
