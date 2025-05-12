import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ensureUrlProtocol } from '../utils/url';
import { MessageItem, Metadata, RepoMetadata } from './models';
export const APP_STORAGE_KEY = 'sashi-state-storage';

interface MessageState {
  messages: MessageItem[];
  metadata: Metadata;
  connectedToHub: boolean;
  apiUrl?: string;
  sessionToken?: string;
  hubUrl?: string;
  rehydrated: boolean;
  setAPIUrl: (apiUrl: string) => void;
  setSessionToken: (sessionToken: string) => void;
  setHubUrl: (hubUrl: string) => void;
  addMessage: (newmessage: MessageItem) => void;
  setMetadata: (metadata: Metadata) => void;
  setConnectedToHub: (connected: boolean) => void;
  clearMessages: () => void;
  subscribedRepos: RepoMetadata[];
  setSubscribedRepos: (repos: RepoMetadata[]) => void;
  setRehydrated: () => void;
}

const useAppStore = create<MessageState>()(
  persist(
    (set, get) => ({
      connectedToHub: false,
      apiUrl: undefined,
      sessionToken: undefined,
      hubUrl: undefined,
      setConnectedToHub: (connected: boolean) => set({ connectedToHub: connected }),
      setHubUrl: (hubUrl: string) => set({ hubUrl: ensureUrlProtocol(hubUrl) }),
      subscribedRepos: [],
      setSubscribedRepos: (repos: RepoMetadata[]) => set({ subscribedRepos: repos }),
      setRehydrated: () => set({ rehydrated: true }),

      messages: [],
      rehydrated: false,
      metadata: {
        name: '',
        description: '',
        functions: [],
        repos: [],
        visualizations: [],
      },
      setSessionToken: (sessionToken: string) => set({ sessionToken }),
      setAPIUrl: (apiUrl: string) => {
        console.log('setAPIUrl', apiUrl);
        set({ apiUrl: ensureUrlProtocol(apiUrl) });
      },
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
      // Add onRehydrateStorage callback
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error during rehydration', error);
        } else {
          state?.setRehydrated();
        }
      },
    }
  )
);

export default useAppStore;
