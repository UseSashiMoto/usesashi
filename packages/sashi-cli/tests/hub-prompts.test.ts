import { promptForHubRegistration } from '../src/utils/hub';

// Mock inquirer
jest.mock('inquirer', () => ({
    prompt: jest.fn()
}));
const inquirer = require('inquirer');

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('Hub Registration Prompts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy.mockClear();
    });

    describe('promptForHubRegistration', () => {
        it('should return null when user skips registration', async () => {
            inquirer.prompt.mockResolvedValueOnce({
                shouldRegister: false
            });

            const result = await promptForHubRegistration();

            expect(result).toBeNull();
            expect(inquirer.prompt).toHaveBeenCalledWith([
                expect.objectContaining({
                    name: 'shouldRegister',
                    type: 'confirm',
                    message: 'Would you like to register with Sashi Hub to get an API key and enable advanced features?',
                    default: true
                })
            ]);
        });

        it('should return null when skipPrompt is true', async () => {
            const result = await promptForHubRegistration({ skipPrompt: true });

            expect(result).toBeNull();
            expect(inquirer.prompt).not.toHaveBeenCalled();
        });

        it('should collect basic registration data', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            const result = await promptForHubRegistration();

            expect(result).toEqual({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Hub Registration')
            );
        });

        it('should validate email format', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            await promptForHubRegistration();

            const emailPrompt = inquirer.prompt.mock.calls[1][0].find(
                (p: any) => p.name === 'email'
            );

            expect(emailPrompt.validate('invalid-email')).toBe('Please enter a valid email address');
            expect(emailPrompt.validate('test@example.com')).toBe(true);
            expect(emailPrompt.validate('user+tag@domain.co.uk')).toBe(true);
        });

        it('should validate password length', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: false });

            await promptForHubRegistration();

            const passwordPrompt = inquirer.prompt.mock.calls[1][0].find(
                (p: any) => p.name === 'password'
            );

            expect(passwordPrompt.validate('short')).toBe('Password must be at least 8 characters');
            expect(passwordPrompt.validate('password123')).toBe(true);
        });

        it('should collect optional fields when requested', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({
                    name: 'Test User',
                    serverUrl: 'https://api.example.com',
                    connectionName: 'Production'
                })
                .mockResolvedValueOnce({ wantGithub: false });

            const result = await promptForHubRegistration();

            expect(result).toEqual({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                serverUrl: 'https://api.example.com',
                connectionName: 'Production'
            });
        });

        it('should validate server URL format', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({
                    serverUrl: 'https://api.example.com'
                })
                .mockResolvedValueOnce({ wantGithub: false });

            await promptForHubRegistration();

            const serverUrlPrompt = inquirer.prompt.mock.calls[3][0].find(
                (p: any) => p.name === 'serverUrl'
            );

            expect(serverUrlPrompt.validate('')).toBe(true); // Optional field
            expect(serverUrlPrompt.validate('invalid-url')).toBe('Please enter a valid URL (e.g., https://api.example.com)');
            expect(serverUrlPrompt.validate('https://api.example.com')).toBe(true);
        });

        it('should collect GitHub configuration', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({
                    name: 'Test User'
                })
                .mockResolvedValueOnce({ wantGithub: true })
                .mockResolvedValueOnce({
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject',
                    repoName: 'Test Project',
                    defaultBranch: 'main'
                });

            const result = await promptForHubRegistration();

            expect(result).toEqual({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                github: {
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject',
                    repoName: 'Test Project',
                    defaultBranch: 'main'
                }
            });

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('GitHub Integration')
            );
        });

        it('should validate GitHub token format', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ wantGithub: true })
                .mockResolvedValueOnce({
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject'
                });

            await promptForHubRegistration();

            const tokenPrompt = inquirer.prompt.mock.calls[5][0].find(
                (p: any) => p.name === 'token'
            );

            expect(tokenPrompt.validate('')).toBe('GitHub token is required');
            expect(tokenPrompt.validate('invalid_token')).toBe('Token must start with "ghp_" or "github_pat_"');
            expect(tokenPrompt.validate('ghp_valid_token')).toBe(true);
            expect(tokenPrompt.validate('github_pat_valid_token')).toBe(true);
        });

        it('should validate GitHub owner format', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ wantGithub: true })
                .mockResolvedValueOnce({
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject'
                });

            await promptForHubRegistration();

            const ownerPrompt = inquirer.prompt.mock.calls[5][0].find(
                (p: any) => p.name === 'owner'
            );

            expect(ownerPrompt.validate('')).toBe('GitHub owner is required');
            expect(ownerPrompt.validate('invalid@user')).toBe('Invalid GitHub username format');
            expect(ownerPrompt.validate('valid-user')).toBe(true);
            expect(ownerPrompt.validate('valid_user')).toBe(true);
            expect(ownerPrompt.validate('valid.user')).toBe(true);
        });

        it('should validate GitHub repo format', async () => {
            inquirer.prompt
                .mockResolvedValueOnce({ shouldRegister: true })
                .mockResolvedValueOnce({
                    email: 'test@example.com',
                    password: 'password123'
                })
                .mockResolvedValueOnce({ wantOptionalFields: true })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ wantGithub: true })
                .mockResolvedValueOnce({
                    token: 'ghp_test_token',
                    owner: 'testuser',
                    repo: 'testproject'
                });

            await promptForHubRegistration();

            const repoPrompt = inquirer.prompt.mock.calls[5][0].find(
                (p: any) => p.name === 'repo'
            );

            expect(repoPrompt.validate('')).toBe('Repository name is required');
            expect(repoPrompt.validate('invalid@repo')).toBe('Invalid repository name format');
            expect(repoPrompt.validate('valid-repo')).toBe(true);
            expect(repoPrompt.validate('valid_repo')).toBe(true);
            expect(repoPrompt.validate('valid.repo')).toBe(true);
        });
    });
});
