import { MessageItem } from '@/store/models';

/**
 * In-memory cache for messages with IndexedDB persistence
 * Provides fast access to messages and offline support
 */
export class MessageCache {
    private cache: Map<string, MessageItem> = new Map();
    private readonly MAX_SIZE: number;
    private readonly DB_NAME = 'ChatDB';
    private readonly STORE_NAME = 'messages';
    private readonly DB_VERSION = 1;

    constructor(maxSize: number = 1000) {
        this.MAX_SIZE = maxSize;
        this.initializeFromIndexedDB();
    }

    /**
     * Add or update a message in the cache
     */
    set(id: string, message: MessageItem): void {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.MAX_SIZE && !this.cache.has(id)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
                this.deleteFromIndexedDB(firstKey);
            }
        }

        this.cache.set(id, message);
        this.persistToIndexedDB(id, message);
    }

    /**
     * Get a message by ID
     */
    get(id: string): MessageItem | undefined {
        return this.cache.get(id);
    }

    /**
     * Get all messages
     */
    getAll(): MessageItem[] {
        return Array.from(this.cache.values());
    }

    /**
     * Get messages by role
     */
    getByRole(role: 'user' | 'assistant'): MessageItem[] {
        return Array.from(this.cache.values()).filter(msg => msg.role === role);
    }

    /**
     * Clear all messages
     */
    clear(): void {
        this.cache.clear();
        this.clearIndexedDB();
    }

    /**
     * Delete a specific message
     */
    delete(id: string): boolean {
        this.deleteFromIndexedDB(id);
        return this.cache.delete(id);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.MAX_SIZE,
            userMessages: this.getByRole('user').length,
            assistantMessages: this.getByRole('assistant').length,
        };
    }

    // IndexedDB operations
    private async openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    private async persistToIndexedDB(id: string, message: MessageItem): Promise<void> {
        try {
            const db = await this.openDB();
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);

            await store.put({ ...message, id });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            db.close();
        } catch (error) {
            console.error('Failed to persist message to IndexedDB:', error);
        }
    }

    private async initializeFromIndexedDB(): Promise<void> {
        try {
            const db = await this.openDB();
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const messages = request.result as MessageItem[];
                messages.forEach(msg => {
                    if (this.cache.size < this.MAX_SIZE) {
                        this.cache.set(msg.id, msg);
                    }
                });
                console.log(`Loaded ${messages.length} messages from IndexedDB`);
            };

            db.close();
        } catch (error) {
            console.error('Failed to initialize from IndexedDB:', error);
        }
    }

    private async deleteFromIndexedDB(id: string): Promise<void> {
        try {
            const db = await this.openDB();
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);

            await store.delete(id);

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            db.close();
        } catch (error) {
            console.error('Failed to delete message from IndexedDB:', error);
        }
    }

    private async clearIndexedDB(): Promise<void> {
        try {
            const db = await this.openDB();
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);

            await store.clear();

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            db.close();
        } catch (error) {
            console.error('Failed to clear IndexedDB:', error);
        }
    }
}

// Singleton instance
let messageCacheInstance: MessageCache | null = null;

/**
 * Get the singleton message cache instance
 */
export const getMessageCache = (): MessageCache => {
    if (!messageCacheInstance) {
        messageCacheInstance = new MessageCache();
    }
    return messageCacheInstance;
};

