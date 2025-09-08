import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock fetch for testing
global.fetch = jest.fn();

describe('sashi hub registration', () => {
    let testDir: string;
    let origCwd: string;
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        testDir = global.testUtils.createTempDir();
        origCwd = process.cwd();
        mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
        mockFetch.mockClear();
    });

    afterEach(() => {
        process.chdir(origCwd);
        global.testUtils.cleanupTempDir(testDir);
    });

    test('should create config with custom hub URL when provided', () => {
        const projectName = 'hub-test';
        const hubUrl = 'http://localhost:3004';
        
        process.chdir(testDir);
        
        // Mock successful registration response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({
                apiKey: 'test-api-key-123',
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User'
                }
            })
        } as any);

        // Test init command with custom hub URL
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName} --hub-url ${hubUrl}`, {
            input: 'n\n', // Skip hub registration for this test
            stdio: 'pipe'
        });

        const projectDir = path.join(testDir, projectName);
        
        // Check config file includes custom hub URL
        const configContent = fs.readFileSync(path.join(projectDir, 'sashi.config.ts'), 'utf-8');
        expect(configContent).toContain(hubUrl);

        // Check .env.local file includes custom hub URL
        const envContent = fs.readFileSync(path.join(projectDir, '.env.local'), 'utf-8');
        expect(envContent).toContain(`HUB_URL=${hubUrl}`);
    });

    test('should create config with default hub URL when none provided', () => {
        const projectName = 'default-hub-test';
        
        process.chdir(testDir);
        
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`, {
            input: 'n\n', // Skip hub registration
            stdio: 'pipe'
        });

        const projectDir = path.join(testDir, projectName);
        
        // Check config file includes default hub URL
        const configContent = fs.readFileSync(path.join(projectDir, 'sashi.config.ts'), 'utf-8');
        expect(configContent).toContain('https://hub.usesashi.com');

        // Check .env.local file includes default hub URL
        const envContent = fs.readFileSync(path.join(projectDir, '.env.local'), 'utf-8');
        expect(envContent).toContain('HUB_URL=https://hub.usesashi.com');
    });

    test('should handle successful hub registration with minimal data', async () => {
        const testApiKey = 'test-api-key-456';
        const testUser = {
            id: 'user-456',
            email: 'minimal@example.com',
            name: 'Minimal User'
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({
                apiKey: testApiKey,
                user: testUser
            })
        } as any);

        const projectName = 'registration-test';
        process.chdir(testDir);

        // Simulate user input for hub registration
        const input = [
            'y',                           // Join hub
            'minimal@example.com',         // Email
            'testpassword',               // Password
            'Minimal User',               // Name
            'n',                          // Skip server setup
            'n',                          // Skip GitHub setup
            ''                            // End input
        ].join('\n');

        try {
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`, {
                input,
                stdio: 'pipe',
                timeout: 10000
            });
        } catch (error) {
            // Expected to fail due to input simulation, but should have made API call
        }

        // Verify API was called with correct data
        expect(mockFetch).toHaveBeenCalledWith(
            'https://hub.usesashi.com/api/sashi/register',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: expect.stringContaining('minimal@example.com')
            })
        );
    });

    test('should handle successful hub registration with full data including GitHub', async () => {
        const testApiKey = 'test-api-key-789';
        const testUser = {
            id: 'user-789',
            email: 'full@example.com',
            name: 'Full User'
        };
        const testServerConnection = {
            id: 'conn-123',
            name: 'Local Development',
            url: 'http://localhost:3000',
            apiToken: 'connection-token-123'
        };
        const testGithubConfig = {
            id: 'github-123',
            owner: 'testuser',
            repo: 'testrepo',
            repoName: 'Test Repository',
            defaultBranch: 'main'
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValue({
                apiKey: testApiKey,
                user: testUser,
                serverConnection: testServerConnection,
                githubConfig: testGithubConfig
            })
        } as any);

        // Verify API was called with GitHub configuration
        const expectedBody = JSON.parse('{"email":"full@example.com","password":"testpassword","name":"Full User","serverUrl":"http://localhost:3000","connectionName":"Local Development","github":{"token":"ghp_test_token","owner":"testuser","repo":"testrepo","repoName":"Test Repository","defaultBranch":"main"}}');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://hub.usesashi.com/api/sashi/register',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(expectedBody)
            })
        );
    });

    test('should handle registration API errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const projectName = 'error-test';
        process.chdir(testDir);

        // Should continue even if registration fails
        const input = [
            'y',                    // Join hub
            'error@example.com',    // Email
            'testpassword',        // Password
            'Error User',          // Name
            'n',                   // Skip server
            'n',                   // Skip GitHub
            ''
        ].join('\n');

        try {
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`, {
                input,
                stdio: 'pipe',
                timeout: 10000
            });
        } catch (error) {
            // Expected due to input simulation
        }

        // Project should still be created even if registration fails
        const projectDir = path.join(testDir, projectName);
        expect(fs.existsSync(projectDir)).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'sashi.config.ts'))).toBe(true);
    });

    test('should handle HTTP error responses from registration API', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            statusText: 'Conflict',
            json: jest.fn().mockResolvedValue({
                error: 'User with this email already exists'
            })
        } as any);

        const projectName = 'conflict-test';
        process.chdir(testDir);

        const input = [
            'y',                      // Join hub
            'existing@example.com',   // Email that already exists
            'testpassword',          // Password
            '',                      // Skip name
            'n',                     // Skip server
            'n',                     // Skip GitHub
            ''
        ].join('\n');

        try {
            execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js init ${projectName}`, {
                input,
                stdio: 'pipe',
                timeout: 10000
            });
        } catch (error) {
            // Expected due to input simulation
        }

        // Should still create project files with placeholder API key
        const projectDir = path.join(testDir, projectName);
        const envContent = fs.readFileSync(path.join(projectDir, '.env.local'), 'utf-8');
        expect(envContent).toContain('HUB_API_SECRET_KEY=your-hub-secret-key-here');
    });

    test('should update existing project configuration with hub settings', () => {
        // Create a mock existing project
        global.testUtils.createMockPackageJson(testDir, {
            name: 'existing-project',
            dependencies: {
                express: '^4.18.0'
            }
        });

        process.chdir(testDir);

        const hubUrl = 'http://localhost:3004';
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup --hub-url ${hubUrl}`, {
            input: 'n\n', // Skip hub registration
            stdio: 'pipe'
        });

        // Check that config files were created with custom hub URL
        const configContent = fs.readFileSync(path.join(testDir, 'sashi.config.js'), 'utf-8');
        expect(configContent).toContain(hubUrl);

        const envContent = fs.readFileSync(path.join(testDir, '.env.local'), 'utf-8');
        expect(envContent).toContain(`HUB_URL=${hubUrl}`);
    });

    test('should preserve existing hub configuration when present', () => {
        // Create existing config with hub settings
        const existingEnv = `# Existing Configuration
OPENAI_API_KEY=existing-key
HUB_API_SECRET_KEY=existing-hub-key
HUB_URL=http://existing-hub.com
`;
        fs.writeFileSync(path.join(testDir, '.env.local'), existingEnv);

        global.testUtils.createMockPackageJson(testDir);
        process.chdir(testDir);

        // Run setup with different hub URL - should respect existing if not overridden
        execSync(`node /Users/deonrobinson/workspace/usesashi/packages/sashi-cli/dist-simple/simple-index.js setup`, {
            input: 'n\n', // Skip hub registration
            stdio: 'pipe'
        });

        // Should create config that respects environment variable
        const configContent = fs.readFileSync(path.join(testDir, 'sashi.config.js'), 'utf-8');
        expect(configContent).toContain('process.env.HUB_URL');
    });
});