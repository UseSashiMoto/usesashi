import { SavedWorkflow } from '@/models/payload';
import useAppStore from '@/store/chat-store';
import { HEADER_API_TOKEN } from '@/utils/contants';
import { ensureUrlProtocol } from './url';

export interface WorkflowStorageOptions {
    serverUrl?: string;
    apiHeaders?: Record<string, string>;
}

/**
 * WorkflowStorage - A utility class for storing and managing workflow data on the server
 */
export class WorkflowStorage {
    private serverUrl?: string;
    private apiHeaders?: Record<string, string>;

    constructor(options: WorkflowStorageOptions = {}) {
        // Try to get apiUrl from the app store or options to use as server URL
        const appStore = typeof window !== 'undefined' ? useAppStore.getState() : null;
        const apiUrlFromStore = appStore?.apiUrl;

        // Set server URL, preferring options over store values, and ensure it has a protocol
        const rawServerUrl = options.serverUrl || apiUrlFromStore;
        this.serverUrl = rawServerUrl ? ensureUrlProtocol(rawServerUrl) : undefined;

        this.apiHeaders = options.apiHeaders;

        console.log(`WorkflowStorage initialized with server URL: ${this.serverUrl}`);
    }

    /**
     * Save a workflow to storage
     */
    async saveWorkflow(workflow: SavedWorkflow): Promise<void> {
        return this.saveToServer(workflow);
    }

    /**
     * Update an existing workflow in storage
     */
    async updateWorkflow(workflow: SavedWorkflow): Promise<void> {
        return this.updateInServer(workflow);
    }

    /**
     * Get a workflow by ID
     */
    async getWorkflow(id: string): Promise<SavedWorkflow | null> {
        return this.getFromServer(id);
    }

    /**
     * Get all workflows (async version)
     */
    async getAllWorkflowsAsync(): Promise<SavedWorkflow[]> {
        return this.getAllFromServer();
    }

    /**
     * Delete a workflow by ID
     */
    async deleteWorkflow(id: string): Promise<void> {
        return this.deleteFromServer(id);
    }

    /**
     * Delete all workflows
     */
    async clearWorkflows(): Promise<void> {
        return this.clearServer();
    }

    // =============== SERVER IMPLEMENTATION ===============

    private getApiToken(): string | undefined {
        const appStore = typeof window !== 'undefined' ? useAppStore.getState() : null;
        return appStore?.apiToken;
    }

    private async saveToServer(workflow: SavedWorkflow): Promise<void> {
        console.log("saving workflow...", workflow)
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                console.error("workflow.service.ts: Error saving workflow to server:", response)
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            throw error;
        }
    }

    private async updateInServer(workflow: SavedWorkflow): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows/${workflow.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error updating in server:', error);
            throw error;
        }
    }

    private async getFromServer(id: string): Promise<SavedWorkflow | null> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows/${id}`, {
                headers: {
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Server error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting from server:', error);
            throw error;
        }
    }

    private async getAllFromServer(): Promise<SavedWorkflow[]> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                headers: {
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting all from server:', error);
            throw error;
        }
    }

    private async deleteFromServer(id: string): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows/${id}`, {
                method: 'DELETE',
                headers: {
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting from server:', error);
            throw error;
        }
    }

    private async clearServer(): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const apiToken = this.getApiToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                method: 'DELETE',
                headers: {
                    ...(apiToken && { [HEADER_API_TOKEN]: apiToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error clearing server:', error);
            throw error;
        }
    }
} 