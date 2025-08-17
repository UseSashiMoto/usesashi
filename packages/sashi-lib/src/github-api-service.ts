import { HEADER_API_TOKEN } from "./utils/constants";

export interface GitHubConfig {
    token: string;
    owner: string;
    repo: string;
}

export interface GitHubFile {
    path: string;
    content: string;
    sha?: string;
}

export interface GitHubSearchResult {
    path: string;
    repository: {
        full_name: string;
    };
    html_url: string;
}

export interface GitHubPullRequest {
    number: number;
    title: string;
    html_url: string;
    head: {
        ref: string;
    };
}

export class GitHubAPIService {
    private config: GitHubConfig;
    private baseUrl = 'https://api.github.com';

    constructor(config: GitHubConfig) {
        this.config = config;
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`GitHub API error: ${response.status} - ${error.message}`);
        }

        return response.json();
    }

    /**
     * Test repository access
     */
    async testConnection(): Promise<any> {
        return this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}`);
    }

    /**
     * Search for files in the repository
     */
    async searchFiles(query: string): Promise<GitHubSearchResult[]> {
        const searchQuery = `${query} repo:${this.config.owner}/${this.config.repo}`;
        const result = await this.makeRequest(`/search/code?q=${encodeURIComponent(searchQuery)}`);
        return result.items || [];
    }

    /**
     * Get file content
     */
    async getFileContent(path: string): Promise<GitHubFile> {
        const result = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}`);

        if (result.type !== 'file') {
            throw new Error('Path is not a file');
        }

        const content = result.encoding === 'base64'
            ? atob(result.content.replace(/\n/g, ''))
            : result.content;

        return {
            path: result.path,
            content,
            sha: result.sha
        };
    }

    /**
     * Search for files containing specific text
     */
    async findFilesWithText(searchText: string, fileExtensions: string[] = ['.tsx', '.ts', '.js', '.jsx']): Promise<GitHubSearchResult[]> {
        const extensionQuery = fileExtensions.map(ext => `extension:${ext.replace('.', '')}`).join(' ');
        const query = `"${searchText}" ${extensionQuery} repo:${this.config.owner}/${this.config.repo}`;

        try {
            const result = await this.makeRequest(`/search/code?q=${encodeURIComponent(query)}`);
            return result.items || [];
        } catch (error) {
            console.warn('File search failed, trying broader search:', error);
            // Fallback to simpler search
            return this.searchFiles(searchText);
        }
    }

    /**
     * Get repository default branch
     */
    async getDefaultBranch(): Promise<string> {
        const repo = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}`);
        return repo.default_branch || 'main';
    }

    /**
     * Create a new branch
     */
    async createBranch(branchName: string, fromBranch?: string): Promise<void> {
        const baseBranch = fromBranch || await this.getDefaultBranch();

        // Get the SHA of the base branch
        const ref = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${baseBranch}`);
        const sha = ref.object.sha;

        // Create new branch
        await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/git/refs`, {
            method: 'POST',
            body: JSON.stringify({
                ref: `refs/heads/${branchName}`,
                sha: sha
            })
        });
    }

    /**
     * Update file content
     */
    async updateFile(path: string, content: string, message: string, branch: string): Promise<any> {
        // Get current file to get SHA
        let sha: string | undefined;
        try {
            const currentFile = await this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${branch}`);
            sha = currentFile.sha;
        } catch (error) {
            // File doesn't exist, that's okay for new files
            console.log(`File ${path} doesn't exist, creating new file`);
        }

        const body: any = {
            message,
            content: btoa(content), // Base64 encode
            branch
        };

        if (sha) {
            body.sha = sha;
        }

        return this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    /**
     * Create a pull request
     */
    async createPullRequest(title: string, body: string, headBranch: string, baseBranch?: string): Promise<GitHubPullRequest> {
        const base = baseBranch || await this.getDefaultBranch();

        return this.makeRequest(`/repos/${this.config.owner}/${this.config.repo}/pulls`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                body,
                head: headBranch,
                base
            })
        });
    }

    /**
     * Analyze code change request and find relevant files
     */
    async analyzeChangeRequest(request: string): Promise<{
        searchTerms: string[];
        likelyFiles: GitHubSearchResult[];
        suggestions: string[];
    }> {
        // Extract potential search terms from the request
        const searchTerms = this.extractSearchTerms(request);

        // Search for relevant files
        const fileSearchPromises = searchTerms.map(term =>
            this.findFilesWithText(term).catch(() => [])
        );

        const searchResults = await Promise.all(fileSearchPromises);
        const allFiles = searchResults.flat();

        // Remove duplicates and rank by relevance
        const uniqueFiles = this.deduplicateAndRankFiles(allFiles, searchTerms);

        return {
            searchTerms,
            likelyFiles: uniqueFiles.slice(0, 10), // Top 10 most relevant
            suggestions: this.generateFileSuggestions(request, uniqueFiles)
        };
    }

    /**
     * Create a complete code change workflow
     */
    async executeCodeChange(
        request: string,
        targetFile: string,
        currentContent: string,
        newContent: string
    ): Promise<GitHubPullRequest> {
        const branchName = `sashi-update-${Date.now()}`;
        const timestamp = new Date().toISOString().split('T')[0];

        // Create branch
        await this.createBranch(branchName);

        // Update file
        await this.updateFile(
            targetFile,
            newContent,
            `Update ${targetFile}: ${request}`,
            branchName
        );

        // Create PR with short summary title and detailed description
        const prTitle = this.generateShortSummary(request);
        const prBody = `## Summary
${request}

## Changes Made
**File Modified:** \`${targetFile}\`

## Detailed Description
This pull request implements the following changes:
- ${request}

## Implementation Details
- Modified file: \`${targetFile}\`
- Changes applied: ${request}
- Branch: \`${branchName}\`

## Testing Recommendations
Please test the following functionality after merging:
- Verify the changes work as expected
- Check for any side effects or regressions
- Test related components or features

---
*This pull request was created by Sashi AI Assistant on ${timestamp}*`;

        return this.createPullRequest(prTitle, prBody, branchName);
    }

    private generateShortSummary(request: string): string {
        // Remove common filler words and normalize
        const cleanRequest = request
            .toLowerCase()
            .replace(/\b(please|can you|could you|i want to|i need to|let's|the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Extract key action and target
        const actionMatch = cleanRequest.match(/\b(add|remove|update|fix|change|create|delete|modify|implement|refactor|build|setup|configure)\b/);
        const action = actionMatch ? actionMatch[0] : 'update';

        // Extract main subject (component, feature, etc.)
        let subject = '';

        // Look for component names (capitalized words ending with common suffixes)
        const componentMatch = cleanRequest.match(/\b[a-z]*[A-Z][a-zA-Z]*(?:component|button|modal|form|page|service|hook|menu|card|input|table|list)\b/i);
        if (componentMatch && componentMatch[0]) {
            subject = componentMatch[0];
        } else {
            // Look for quoted text (often the main feature/element)
            const quotedMatch = request.match(/"([^"]+)"/);
            if (quotedMatch && quotedMatch[1]) {
                subject = quotedMatch[1];
            } else {
                // Extract first meaningful noun or phrase
                const words = cleanRequest.split(' ').filter(w => w.length > 2);
                if (words.length > 1) {
                    subject = words.slice(1, 3).join(' '); // Take 1-2 words after action
                } else if (words.length === 1 && words[0]) {
                    subject = words[0];
                }
            }
        }

        // Capitalize first letter and create title
        const capitalizedAction = action.charAt(0).toUpperCase() + action.slice(1);
        const capitalizedSubject = subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : '';

        // Create concise title (max ~60 characters for good GitHub display)
        const title = capitalizedSubject ? `${capitalizedAction} ${capitalizedSubject}` : capitalizedAction;

        // Truncate if too long, but try to keep it meaningful
        if (title.length > 60) {
            return title.substring(0, 57) + '...';
        }

        return title;
    }

    private extractSearchTerms(request: string): string[] {
        const terms: string[] = [];

        // Common UI element terms
        const uiTerms = {
            'button': ['button', 'btn', 'Button'],
            'login': ['login', 'signin', 'auth', 'Login', 'SignIn'],
            'footer': ['footer', 'Footer'],
            'header': ['header', 'navbar', 'nav', 'Header', 'Navbar'],
            'color': ['color', 'background', 'theme', 'css', 'style'],
            'text': ['text', 'title', 'content', 'label'],
            'link': ['link', 'href', 'anchor', 'Link'],
            'menu': ['menu', 'navigation', 'nav', 'Menu']
        };

        const lowerRequest = request.toLowerCase();

        // Extract quoted text
        const quotedMatches = request.match(/"([^"]+)"/g);
        if (quotedMatches) {
            terms.push(...quotedMatches.map(match => match.slice(1, -1)));
        }

        // Add UI-specific terms
        Object.entries(uiTerms).forEach(([key, values]) => {
            if (lowerRequest.includes(key)) {
                terms.push(...values);
            }
        });

        // Extract potential component/file names
        const componentMatches = request.match(/\b[A-Z][a-zA-Z]*\b/g);
        if (componentMatches) {
            terms.push(...componentMatches);
        }

        return [...new Set(terms)]; // Remove duplicates
    }

    private deduplicateAndRankFiles(files: GitHubSearchResult[], searchTerms: string[]): GitHubSearchResult[] {
        const uniqueFiles = new Map<string, GitHubSearchResult>();

        files.forEach(file => {
            if (!uniqueFiles.has(file.path)) {
                uniqueFiles.set(file.path, file);
            }
        });

        return Array.from(uniqueFiles.values()).sort((a, b) => {
            const scoreA = this.calculateFileRelevance(a.path, searchTerms);
            const scoreB = this.calculateFileRelevance(b.path, searchTerms);
            return scoreB - scoreA;
        });
    }

    private calculateFileRelevance(filePath: string, searchTerms: string[]): number {
        let score = 0;
        const lowerPath = filePath.toLowerCase();

        searchTerms.forEach(term => {
            if (lowerPath.includes(term.toLowerCase())) {
                score += 1;
            }
        });

        // Boost scores for common UI file patterns
        if (lowerPath.includes('component')) score += 2;
        if (lowerPath.includes('page')) score += 2;
        if (lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx')) score += 1;
        if (lowerPath.includes('style') || lowerPath.includes('.css')) score += 1;

        return score;
    }

    private generateFileSuggestions(request: string, files: GitHubSearchResult[]): string[] {
        const suggestions: string[] = [];

        if (files.length === 0) {
            suggestions.push("No files found matching your request. Try being more specific about the component or file you want to modify.");
        } else if (files.length === 1) {
            suggestions.push(`Found 1 relevant file: ${files[0]?.path}`);
        } else {
            suggestions.push(`Found ${files.length} potentially relevant files. The most likely candidates are:`);
            files.slice(0, 3).forEach(file => {
                suggestions.push(`- ${file.path}`);
            });
        }

        return suggestions;
    }
}

// Singleton instance
let githubAPIService: GitHubAPIService | null = null;

/**
 * Initialize GitHub API service with configuration
 */
export function initializeGitHubAPI(config: GitHubConfig): GitHubAPIService {
    githubAPIService = new GitHubAPIService(config);
    return githubAPIService;
}

/**
 * Get current GitHub API service instance
 */
export function getGitHubAPIService(): GitHubAPIService | null {
    return githubAPIService;
}


export async function getGithubConfig(config?: { hubUrl?: string, apiSecretKey?: string }): Promise<GitHubConfig | undefined> {
    try {
        if (!config || !config.hubUrl || !config.apiSecretKey) {
            return undefined;
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            [HEADER_API_TOKEN]: config?.apiSecretKey,
        };

        // Prepare the request options
        const fetchOptions: RequestInit = {
            method: "GET",
            headers,
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(30000), // 30 second timeout
        };

        const hubResponse = await fetch(`${config.hubUrl}/github/config`, fetchOptions);

        if (!hubResponse.ok) {
            return undefined;
        }

        const githubConfig = await hubResponse.json();
        return githubConfig;
    } catch (error) {
        console.error('no GitHub config found:', error);
        return undefined;
    }
}