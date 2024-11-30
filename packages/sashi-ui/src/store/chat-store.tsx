import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MessageItem, Metadata, RepoMetadata } from './models';
export const APP_STORAGE_KEY = 'openai-api-function-call-sample-storage';

interface MessageState {
  messages: MessageItem[];
  metadata: Metadata;
  connectedToHub: boolean;
  apiUrl?: string;
  sessionToken?: string;
  setAPIUrl: (apiUrl: string) => void;
  setSessionToken: (sessionToken: string) => void;
  addMessage: (newmessage: MessageItem) => void;
  setMetadata: (metadata: Metadata) => void;
  setConnectedToHub: (connected: boolean) => void;
  clearMessages: () => void;
  subscribedRepos: RepoMetadata[];
  setSubscribedRepos: (repos: RepoMetadata[]) => void;
}

const useAppStore = create<MessageState>()(
  persist(
    (set, get) => ({
      connectedToHub: false,
      setConnectedToHub: (connected: boolean) => set({ connectedToHub: connected }),
      subscribedRepos: [],
      setSubscribedRepos: (repos: RepoMetadata[]) => set({ subscribedRepos: repos }),
      messages: [],
      metadata: {
        name: '',
        description: '',
        functions: [],
        repos: [],
        visualizations: [],
      },
      setSessionToken: (sessionToken: string) => set({ sessionToken }),
      setAPIUrl: (apiUrl: string) => set({ apiUrl }),
      setMetadata: (metadata: Metadata) => set({ metadata }),
      addMessage: (newmessage: MessageItem) => {
        let messages = get().messages.slice(0);
        messages.push(newmessage);

        set({
          messages: messages,
        });
      },
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: APP_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

export default useAppStore;
