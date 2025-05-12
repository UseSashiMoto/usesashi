import { SavedWorkflow } from '@/pages/DashboardPage';
import useAppStore from '@/store/chat-store';
import { ensureUrlProtocol } from './url';

// Storage types supported by the WorkflowStorage
export type StorageType = 'localStorage' | 'indexedDB' | 'api' | 'server';

export interface WorkflowStorageOptions {
    storageType?: StorageType;
    apiEndpoint?: string;
    namespace?: string;
    apiHeaders?: Record<string, string>;
    serverUrl?: string;
}

/**
 * WorkflowStorage - A utility class for storing and managing workflow data
 * 
 * This class provides multiple storage options for workflow data:
 * 1. middleware - Middleware server that decides where to store (default)
 * 2. localStorage - Simple key-value storage in the browser
 * 3. indexedDB - More powerful browser database for larger data
 * 4. api - Custom API endpoint for server-side storage
 * 
 * Similar libraries:
 * - localForage: https://github.com/localForage/localForage
 * - Dexie.js: https://dexie.org/
 * - PouchDB: https://pouchdb.com/
 */
export class WorkflowStorage {
    private storageType: StorageType;
    private apiEndpoint?: string;
    private serverUrl?: string;
    private namespace: string;
    private apiHeaders?: Record<string, string>;
    private dbPromise: Promise<IDBDatabase> | null = null;
    private DB_NAME = 'sashi-workflows';
    private STORE_NAME = 'workflows';
    private DB_VERSION = 1;

    constructor(options: WorkflowStorageOptions = {}) {
        // Try to get apiUrl from the app store or options to use as middleware URL
        const appStore = typeof window !== 'undefined' ? useAppStore.getState() : null;
        const apiUrlFromStore = appStore?.apiUrl;

        // Set server URL, preferring options over store values, and ensure it has a protocol
        const rawServerUrl = options.serverUrl || apiUrlFromStore;
        this.serverUrl = rawServerUrl ? ensureUrlProtocol(rawServerUrl) : undefined;

        // Default to server if it's available, otherwise use localStorage
        this.storageType = this.serverUrl ? (options.storageType || 'server') : (options.storageType || 'localStorage');

        this.apiEndpoint = options.apiEndpoint;
        this.namespace = options.namespace || 'sashi-workflows';
        this.apiHeaders = options.apiHeaders;

        // Initialize IndexedDB if needed
        if (this.storageType === 'indexedDB') {
            this.initIndexedDB();
        }

        console.log(`WorkflowStorage initialized with storage type: ${this.storageType}`);
        if (this.storageType === 'server') {
            console.log(`Using server URL: ${this.serverUrl}`);
        }
    }

    /**
     * Save a workflow to storage
     */
    async saveWorkflow(workflow: SavedWorkflow): Promise<void> {
        switch (this.storageType) {
            case 'localStorage':
                return this.saveToLocalStorage(workflow);
            case 'indexedDB':
                return this.saveToIndexedDB(workflow);
            case 'api':
                return this.saveToAPI(workflow);
            case 'server':
                return this.saveToMiddleware(workflow);
        }
    }

    /**
     * Update an existing workflow in storage
     */
    async updateWorkflow(workflow: SavedWorkflow): Promise<void> {
        switch (this.storageType) {
            case 'localStorage':
                return this.saveToLocalStorage(workflow); // Same as save for localStorage
            case 'indexedDB':
                return this.saveToIndexedDB(workflow); // Same as save for IndexedDB
            case 'api':
                return this.updateInAPI(workflow);
            case 'server':
                return this.updateInMiddleware(workflow);
        }
    }

    /**
     * Get a workflow by ID
     */
    async getWorkflow(id: string): Promise<SavedWorkflow | null> {
        switch (this.storageType) {
            case 'localStorage':
                return this.getFromLocalStorage(id);
            case 'indexedDB':
                return this.getFromIndexedDB(id);
            case 'api':
                return this.getFromAPI(id);
            case 'server':
                return this.getFromMiddleware(id);
            default:
                return null;
        }
    }

    /**
     * Get all workflows
     */
    getAllWorkflows(): SavedWorkflow[] {
        switch (this.storageType) {
            case 'localStorage':
                return this.getAllFromLocalStorage();
            case 'indexedDB':
                // For simplicity in this example, we just return an empty array
                // In a real implementation, this would be asynchronous
                console.warn('getAllWorkflows is synchronous but IndexedDB is async. Use getAllWorkflowsAsync instead.');
                return [];
            case 'api':
                console.warn('getAllWorkflows is synchronous but API is async. Use getAllWorkflowsAsync instead.');
                return [];
            case 'server':
                console.warn('getAllWorkflows is synchronous but Server is async. Use getAllWorkflowsAsync instead.');
                return [];
            default:
                return [];
        }
    }

    /**
     * Get all workflows (async version)
     */
    async getAllWorkflowsAsync(): Promise<SavedWorkflow[]> {
        switch (this.storageType) {
            case 'localStorage':
                return this.getAllFromLocalStorage();
            case 'indexedDB':
                return this.getAllFromIndexedDB();
            case 'api':
                return this.getAllFromAPI();
            case 'server':
                return this.getAllFromMiddleware();
            default:
                return [];
        }
    }

    /**
     * Delete a workflow by ID
     */
    async deleteWorkflow(id: string): Promise<void> {
        switch (this.storageType) {
            case 'localStorage':
                return this.deleteFromLocalStorage(id);
            case 'indexedDB':
                return this.deleteFromIndexedDB(id);
            case 'api':
                return this.deleteFromAPI(id);
            case 'server':
                return this.deleteFromMiddleware(id);
        }
    }

    /**
     * Delete all workflows
     */
    async clearWorkflows(): Promise<void> {
        switch (this.storageType) {
            case 'localStorage':
                return this.clearLocalStorage();
            case 'indexedDB':
                return this.clearIndexedDB();
            case 'api':
                return this.clearAPI();
            case 'server':
                return this.clearMiddleware();
        }
    }

    /**
     * Change the storage type
     */
    setStorageType(type: StorageType, options: Partial<WorkflowStorageOptions> = {}): void {
        this.storageType = type;

        if (options.apiEndpoint) {
            this.apiEndpoint = options.apiEndpoint;
        }

        if (options.namespace) {
            this.namespace = options.namespace;
        }

        if (options.apiHeaders) {
            this.apiHeaders = options.apiHeaders;
        }

        if (options.serverUrl) {
            this.serverUrl = options.serverUrl;
        } else if (this.storageType === 'server' && !this.serverUrl) {
            // Try to get apiUrl from the app store if not provided
            const appStore = typeof window !== 'undefined' ? useAppStore.getState() : null;
            this.serverUrl = appStore?.apiUrl;

            if (!this.serverUrl) {
                console.warn('Server URL not configured. Falling back to localStorage.');
                this.storageType = 'localStorage';
            }
        }

        // Initialize IndexedDB if needed
        if (this.storageType === 'indexedDB') {
            this.initIndexedDB();
        }

        console.log(`Switched storage type to: ${this.storageType}`);
    }

    // =============== LOCAL STORAGE IMPLEMENTATION ===============

    private saveToLocalStorage(workflow: SavedWorkflow): void {
        try {
            // Get existing workflows
            const workflows = this.getAllFromLocalStorage();

            // Find the index of the workflow with the same ID
            const index = workflows.findIndex(w => w.id === workflow.id);

            if (index !== -1) {
                // Update existing workflow
                workflows[index] = workflow;
            } else {
                // Add new workflow
                workflows.push(workflow);
            }

            // Save back to localStorage
            localStorage.setItem(this.namespace, JSON.stringify(workflows));
        } catch (error) {
            console.error('Error saving workflow to localStorage:', error);
        }
    }

    private getFromLocalStorage(id: string): SavedWorkflow | null {
        try {
            const workflows = this.getAllFromLocalStorage();
            return workflows.find(w => w.id === id) || null;
        } catch (error) {
            console.error('Error getting workflow from localStorage:', error);
            return null;
        }
    }

    private getAllFromLocalStorage(): SavedWorkflow[] {
        try {
            const data = localStorage.getItem(this.namespace);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting workflows from localStorage:', error);
            return [];
        }
    }

    private deleteFromLocalStorage(id: string): void {
        try {
            const workflows = this.getAllFromLocalStorage();
            const filteredWorkflows = workflows.filter(w => w.id !== id);
            localStorage.setItem(this.namespace, JSON.stringify(filteredWorkflows));
        } catch (error) {
            console.error('Error deleting workflow from localStorage:', error);
        }
    }

    private clearLocalStorage(): void {
        try {
            localStorage.removeItem(this.namespace);
        } catch (error) {
            console.error('Error clearing workflows from localStorage:', error);
        }
    }

    // =============== INDEXED DB IMPLEMENTATION ===============

    private initIndexedDB(): void {
        this.dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported in this browser'));
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event);
                reject(new Error('Error opening IndexedDB'));
            };

            request.onsuccess = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    private async getIndexedDB(): Promise<IDBDatabase> {
        if (!this.dbPromise) {
            this.initIndexedDB();
        }
        return this.dbPromise!;
    }

    private async saveToIndexedDB(workflow: SavedWorkflow): Promise<void> {
        try {
            const db = await this.getIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);

                const request = store.put(workflow);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Error saving workflow to IndexedDB'));
            });
        } catch (error) {
            console.error('Error saving to IndexedDB:', error);
            throw error;
        }
    }

    private async getFromIndexedDB(id: string): Promise<SavedWorkflow | null> {
        try {
            const db = await this.getIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);

                const request = store.get(id);

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(new Error('Error getting workflow from IndexedDB'));
            });
        } catch (error) {
            console.error('Error getting from IndexedDB:', error);
            return null;
        }
    }

    private async getAllFromIndexedDB(): Promise<SavedWorkflow[]> {
        try {
            const db = await this.getIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);

                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(new Error('Error getting all workflows from IndexedDB'));
            });
        } catch (error) {
            console.error('Error getting all from IndexedDB:', error);
            return [];
        }
    }

    private async deleteFromIndexedDB(id: string): Promise<void> {
        try {
            const db = await this.getIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);

                const request = store.delete(id);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Error deleting workflow from IndexedDB'));
            });
        } catch (error) {
            console.error('Error deleting from IndexedDB:', error);
            throw error;
        }
    }

    private async clearIndexedDB(): Promise<void> {
        try {
            const db = await this.getIndexedDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);

                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Error clearing workflows from IndexedDB'));
            });
        } catch (error) {
            console.error('Error clearing IndexedDB:', error);
            throw error;
        }
    }

    // =============== API IMPLEMENTATION ===============

    private async saveToAPI(workflow: SavedWorkflow): Promise<void> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving to API:', error);
            throw error;
        }
    }

    private async updateInAPI(workflow: SavedWorkflow): Promise<void> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows/${workflow.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error updating in API:', error);
            throw error;
        }
    }

    private async getFromAPI(id: string): Promise<SavedWorkflow | null> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows/${id}`, {
                headers: this.apiHeaders,
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting from API:', error);
            return null;
        }
    }

    private async getAllFromAPI(): Promise<SavedWorkflow[]> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows`, {
                headers: this.apiHeaders,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting all from API:', error);
            return [];
        }
    }

    private async deleteFromAPI(id: string): Promise<void> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows/${id}`, {
                method: 'DELETE',
                headers: this.apiHeaders,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting from API:', error);
            throw error;
        }
    }

    private async clearAPI(): Promise<void> {
        if (!this.apiEndpoint) {
            throw new Error('API endpoint not configured');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/workflows`, {
                method: 'DELETE',
                headers: this.apiHeaders,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error clearing API:', error);
            throw error;
        }
    }

    // =============== MIDDLEWARE IMPLEMENTATION ===============

    private getSessionToken(): string | undefined {
        const appStore = typeof window !== 'undefined' ? useAppStore.getState() : null;
        return appStore?.sessionToken;
    }

    private async saveToMiddleware(workflow: SavedWorkflow): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving to server:', error);

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            this.saveToLocalStorage(workflow);
        }
    }

    private async updateInMiddleware(workflow: SavedWorkflow): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows/${workflow.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
                    ...this.apiHeaders,
                },
                body: JSON.stringify(workflow),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error updating in server:', error);

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            this.saveToLocalStorage(workflow);
        }
    }

    private async getFromMiddleware(id: string): Promise<SavedWorkflow | null> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows/${id}`, {
                headers: {
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
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

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            return this.getFromLocalStorage(id);
        }
    }

    private async getAllFromMiddleware(): Promise<SavedWorkflow[]> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                headers: {
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting all from server:', error);

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            return this.getAllFromLocalStorage();
        }
    }

    private async deleteFromMiddleware(id: string): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows/${id}`, {
                method: 'DELETE',
                headers: {
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting from server:', error);

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            this.deleteFromLocalStorage(id);
        }
    }

    private async clearMiddleware(): Promise<void> {
        if (!this.serverUrl) {
            throw new Error('Server URL not configured');
        }

        try {
            const sessionToken = this.getSessionToken();

            const response = await fetch(`${this.serverUrl}/workflows`, {
                method: 'DELETE',
                headers: {
                    ...(sessionToken && { 'X-Session-Token': sessionToken }),
                    ...this.apiHeaders,
                },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error clearing server:', error);

            // Fall back to localStorage if server fails
            console.warn('Falling back to localStorage for this operation');
            this.clearLocalStorage();
        }
    }

    /**
     * Debug method to log current workflows to console
     */
    debugWorkflows(): void {
        try {
            const workflows = this.getAllWorkflows();
            console.log(`===== Workflow Storage Debug (${this.namespace}) =====`);
            console.log(`Storage type: ${this.storageType}`);
            if (this.storageType === 'server') {
                console.log(`Server URL: ${this.serverUrl}`);
            }
            console.log(`Total workflows: ${workflows.length}`);
            workflows.forEach((workflow, index) => {
                console.log(`Workflow ${index + 1}: ${workflow.name} (ID: ${workflow.id})`);
                console.log(`  Description: ${workflow.description}`);
                console.log(`  Actions: ${workflow.workflow.actions?.length || 0}`);
                console.log(`  Results: ${workflow.results?.length || 0}`);
                console.log(`  Favorited: ${workflow.favorited}`);
                console.log('---');
            });
            console.log('=============================================');
        } catch (error) {
            console.error('Error debugging workflows:', error);
        }
    }
} 