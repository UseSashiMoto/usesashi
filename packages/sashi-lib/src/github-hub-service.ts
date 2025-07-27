export interface GitHubConfig {
    token: string;
    owner: string;
    repo: string;
    repoName?: string;
    defaultBranch?: string;
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

export class GitHubHubService {
    private baseUrl = 'https://api.github.com';
    private hubUrl: string;
    private sessionToken: string;

    constructor(hubUrl: string, sessionToken: string) {
        this.hubUrl = hubUrl;
        this.sessionToken = sessionToken;
    }

    /**
     * Get GitHub config from hub
     */
    private async getConfig(): Promise<GitHubConfig | null> {
        try {
            const response = await fetch(`${this.hubUrl}/github/config`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 404) {
                return null; // No config found
            }

            if (!response.ok) {
                throw new Error(`Hub error: ${response.status} ${response.statusText}`);
            }

            return response.json();
        } catch (error) {
            console.error('Failed to get GitHub config from hub:', error);
            return null;
        }
    }

    /**
     * Save GitHub config to hub
     */
    async saveConfig(config: GitHubConfig): Promise<void> {
        const response = await fetch(`${this.hubUrl}/github/config`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.sessionToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Failed to save GitHub config: ${error.message}`);
        }
    }

    /**
     * Delete GitHub config from hub
     */
    async deleteConfig(): Promise<void> {
        const response = await fetch(`${this.hubUrl}/github/config`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.sessionToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok && response.status !== 404) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Failed to delete GitHub config: ${error.message}`);
        }
    }

    /**
     * Test if GitHub is configured
     */
    async isConfigured(): Promise<boolean> {
        const config = await this.getConfig();
        return config !== null;
    }

    private async makeGitHubRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        const config = await this.getConfig();

        if (!config) {
            throw new Error('GitHub not configured. Please configure GitHub integration in Settings.');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${config.token}`,
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
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        return this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}`);
    }

    /**
     * Search for files in the repository
     */
    async searchFiles(query: string): Promise<GitHubSearchResult[]> {
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const searchQuery = `${query} repo:${config.owner}/${config.repo}`;
        const result = await this.makeGitHubRequest(`/search/code?q=${encodeURIComponent(searchQuery)}`);
        return result.items || [];
    }

    /**
     * Get file content
     */
    async getFileContent(path: string): Promise<GitHubFile> {
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const result = await this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/contents/${path}`);

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
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const extensionQuery = fileExtensions.map(ext => `extension:${ext.replace('.', '')}`).join(' ');
        const query = `"${searchText}" ${extensionQuery} repo:${config.owner}/${config.repo}`;

        try {
            const result = await this.makeGitHubRequest(`/search/code?q=${encodeURIComponent(query)}`);
            return result.items || [];
        } catch (error) {
            console.warn('File search failed, trying broader search:', error);
            return this.searchFiles(searchText);
        }
    }

    /**
     * Get repository default branch
     */
    async getDefaultBranch(): Promise<string> {
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const repo = await this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}`);
        return repo.default_branch || 'main';
    }

    /**
     * Create a new branch
     */
    async createBranch(branchName: string, fromBranch?: string): Promise<void> {
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const baseBranch = fromBranch || await this.getDefaultBranch();

        // Get the SHA of the base branch
        const ref = await this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/git/ref/heads/${baseBranch}`);
        const sha = ref.object.sha;

        // Create new branch
        await this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/git/refs`, {
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
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        // Get current file to get SHA
        let sha: string | undefined;
        try {
            const currentFile = await this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branch}`);
            sha = currentFile.sha;
        } catch (error) {
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

        return this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    /**
     * Create a pull request
     */
    async createPullRequest(title: string, body: string, headBranch: string, baseBranch?: string): Promise<GitHubPullRequest> {
        const config = await this.getConfig();
        if (!config) {
            throw new Error('GitHub not configured');
        }

        const base = baseBranch || await this.getDefaultBranch();

        return this.makeGitHubRequest(`/repos/${config.owner}/${config.repo}/pulls`, {
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
        const searchTerms = this.extractSearchTerms(request);

        const fileSearchPromises = searchTerms.map(term =>
            this.findFilesWithText(term).catch(() => [])
        );

        const searchResults = await Promise.all(fileSearchPromises);
        const allFiles = searchResults.flat();

        const uniqueFiles = this.deduplicateAndRankFiles(allFiles, searchTerms);

        return {
            searchTerms,
            likelyFiles: uniqueFiles.slice(0, 10),
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

        await this.createBranch(branchName);

        await this.updateFile(
            targetFile,
            newContent,
            `Update ${targetFile}: ${request}`,
            branchName
        );

        const prTitle = `Update ${targetFile.split('/').pop()}: ${request}`;
        const prBody = `## Changes Made

**Request:** ${request}

**File Modified:** \`${targetFile}\`

**Changes:**
- ${request}

---
*This pull request was created by Sashi AI Assistant on ${timestamp}*`;

        return this.createPullRequest(prTitle, prBody, branchName);
    }

    private extractSearchTerms(request: string): string[] {
        const terms: string[] = [];

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

        const quotedMatches = request.match(/"([^"]+)"/g);
        if (quotedMatches) {
            terms.push(...quotedMatches.map(match => match.slice(1, -1)));
        }

        Object.entries(uiTerms).forEach(([key, values]) => {
            if (lowerRequest.includes(key)) {
                terms.push(...values);
            }
        });

        const componentMatches = request.match(/\b[A-Z][a-zA-Z]*\b/g);
        if (componentMatches) {
            terms.push(...componentMatches);
        }

        return [...new Set(terms)];
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

// Service factory function
export function createGitHubHubService(hubUrl: string, sessionToken: string): GitHubHubService {
    return new GitHubHubService(hubUrl, sessionToken);
} 