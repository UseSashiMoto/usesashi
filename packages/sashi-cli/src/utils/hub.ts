import axios from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';

export interface HubRegistrationData {
    email: string;
    password: string;
    name?: string;
    serverUrl?: string;
    connectionName?: string;
    github?: {
        token: string;
        owner: string;
        repo: string;
        repoName?: string;
        defaultBranch?: string;
    };
}

export interface HubRegistrationResponse {
    success: boolean;
    user: {
        id: string;
        email: string;
        name?: string;
    };
    apiKey: string;
    serverConnection?: {
        id: string;
        name: string;
        url: string;
        apiToken: string;
    };
    githubConfig?: {
        id: string;
        owner: string;
        repo: string;
        repoName: string;
        defaultBranch: string;
    };
    message: string;
}

export interface HubRegistrationOptions {
    hubUrl?: string;
    skipPrompt?: boolean;
}

/**
 * Register a new user with the Sashi Hub
 */
export async function registerWithHub(
    registrationData: HubRegistrationData,
    options: HubRegistrationOptions = {}
): Promise<HubRegistrationResponse> {
    const hubUrl = options.hubUrl || 'https://hub.usesashi.com';
    const endpoint = `${hubUrl}/api/sashi/register`;

    try {
        const response = await axios.post<HubRegistrationResponse>(endpoint, registrationData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.data?.error) {
                throw new Error(error.response.data.error);
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error(`Cannot connect to hub at ${hubUrl}. Please check the URL or try again later.`);
            } else {
                throw new Error(`Network error: ${error.message}`);
            }
        }
        throw error;
    }
}

/**
 * Prompt user for hub registration details
 */
export async function promptForHubRegistration(options: HubRegistrationOptions = {}): Promise<HubRegistrationData | null> {
    if (options.skipPrompt) {
        return null;
    }

        // First ask if they want to register
        const { shouldRegister } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'shouldRegister',
                message: 'Would you like to register with Sashi Hub to enable advanced features? (Note: You still need your own OpenAI API key)',
                default: true
            }
        ]);

    if (!shouldRegister) {
        return null;
    }

    console.log(chalk.blue('\n📝 Hub Registration'));
    console.log(chalk.gray('Register with Sashi Hub to enable team collaboration, GitHub integration, and advanced features.'));
    console.log(chalk.yellow('Note: This provides a Hub API key for enhanced features. You still need your own OpenAI API key.\n'));

    // Required fields
    const basicAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: '📧 Email:',
            validate: (input: string) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(input) ? true : 'Please enter a valid email address';
            }
        },
        {
            type: 'password',
            name: 'password',
            message: '🔒 Password:',
            validate: (input: string) => {
                return input.length >= 8 ? true : 'Password must be at least 8 characters';
            }
        }
    ]);

    // Optional fields
    const { wantOptionalFields } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'wantOptionalFields',
            message: 'Would you like to configure optional settings (name, server connection, GitHub integration)?',
            default: false
        }
    ]);

    let optionalAnswers: any = {};

    if (wantOptionalFields) {
        optionalAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: '👤 Display name (optional):'
            },
            {
                type: 'input',
                name: 'serverUrl',
                message: '🌐 Server URL (optional):',
                validate: (input: string) => {
                    if (!input) return true; // Optional field
                    try {
                        new URL(input);
                        return true;
                    } catch {
                        return 'Please enter a valid URL (e.g., https://api.example.com)';
                    }
                }
            },
            {
                type: 'input',
                name: 'connectionName',
                message: '📝 Connection name (optional):',
                when: (answers) => !!answers.serverUrl
            }
        ]);

        // GitHub integration
        const { wantGithub } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'wantGithub',
                message: 'Would you like to set up GitHub integration?',
                default: false
            }
        ]);

        if (wantGithub) {
            console.log(chalk.yellow('\n🐙 GitHub Integration'));
            console.log(chalk.gray('You\'ll need a GitHub Personal Access Token with repo permissions.'));
            console.log(chalk.gray('Create one at: https://github.com/settings/tokens\n'));

            const githubAnswers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'token',
                    message: '🔑 GitHub Token:',
                    validate: (input: string) => {
                        if (!input) return 'GitHub token is required';
                        if (!input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
                            return 'Token must start with "ghp_" or "github_pat_"';
                        }
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'owner',
                    message: '👤 GitHub owner/organization:',
                    validate: (input: string) => {
                        if (!input) return 'GitHub owner is required';
                        const validPattern = /^[a-zA-Z0-9._-]+$/;
                        return validPattern.test(input) ? true : 'Invalid GitHub username format';
                    }
                },
                {
                    type: 'input',
                    name: 'repo',
                    message: '📁 Repository name:',
                    validate: (input: string) => {
                        if (!input) return 'Repository name is required';
                        const validPattern = /^[a-zA-Z0-9._-]+$/;
                        return validPattern.test(input) ? true : 'Invalid repository name format';
                    }
                },
                {
                    type: 'input',
                    name: 'repoName',
                    message: '📝 Display name for repository (optional):'
                },
                {
                    type: 'input',
                    name: 'defaultBranch',
                    message: '🌿 Default branch (optional):',
                    default: 'main'
                }
            ]);

            optionalAnswers.github = githubAnswers;
        }
    }

    return {
        email: basicAnswers.email,
        password: basicAnswers.password,
        name: optionalAnswers.name || undefined,
        serverUrl: optionalAnswers.serverUrl || undefined,
        connectionName: optionalAnswers.connectionName || undefined,
        github: optionalAnswers.github || undefined
    };
}

/**
 * Handle the complete hub registration flow
 */
export async function handleHubRegistration(options: HubRegistrationOptions = {}): Promise<string | null> {
    try {
        const registrationData = await promptForHubRegistration(options);

        if (!registrationData) {
            return null; // User chose not to register
        }

        console.log(chalk.blue('\n🚀 Registering with Sashi Hub...'));

        const response = await registerWithHub(registrationData, options);

        console.log(chalk.green.bold('\n✅ Registration successful!'));
        console.log(chalk.green(`🔑 Your Hub API Key: ${response.apiKey}`));

        if (response.serverConnection) {
            console.log(chalk.green(`🌐 Server connection "${response.serverConnection.name}" configured`));
        }

        if (response.githubConfig) {
            console.log(chalk.green(`🐙 GitHub integration configured for ${response.githubConfig.owner}/${response.githubConfig.repo}`));
        }

        console.log(chalk.yellow('\n💾 Your Hub API key will be added to your environment configuration.'));
        console.log(chalk.gray('This enables hub features like team collaboration and GitHub integration.'));
        console.log(chalk.blue('Remember: You still need to provide your OpenAI API key separately for AI features.\n'));

        return response.apiKey;
    } catch (error) {
        console.error(chalk.red('\n❌ Hub registration failed:'), (error as Error).message);

        // Ask if they want to continue without hub registration
        const { continueWithoutHub } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'continueWithoutHub',
                message: 'Would you like to continue setup without hub registration?',
                default: true
            }
        ]);

        if (!continueWithoutHub) {
            throw new Error('Setup cancelled by user');
        }

        return null;
    }
}

/**
 * Validate hub URL format
 */
export function validateHubUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}
