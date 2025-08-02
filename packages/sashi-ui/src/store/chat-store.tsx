import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ensureUrlProtocol } from '../utils/url';
import { MessageItem, Metadata, RepoMetadata } from './models';
export const APP_STORAGE_KEY = 'sashi-state-storage';

interface MessageState {
  messages: MessageItem[];
  metadata: Metadata;
  connectedToHub: boolean;
  connectedToGithub: boolean;
  githubConfig?: GitHubConfig;
  apiUrl?: string;
  sessionToken?: string;
  apiToken?: string;
  hubUrl?: string;
  rehydrated: boolean;
  setAPIUrl: (apiUrl: string) => void;
  setSessionToken: (sessionToken: string) => void;
  setAPIToken: (apiToken: string) => void;
  setHubUrl: (hubUrl: string) => void;
  addMessage: (newmessage: MessageItem) => void;
  setMetadata: (metadata: Metadata) => void;
  setConnectedToHub: (connected: boolean) => void;
  setConnectedToGithub: (connected: boolean) => void;
  setGithubConfig: (config?: GitHubConfig) => void;
  clearMessages: () => void;
  subscribedRepos: RepoMetadata[];
  setSubscribedRepos: (repos: RepoMetadata[]) => void;
  setRehydrated: () => void;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  repoName?: string;
  defaultBranch?: string;
}

const useAppStore = create<MessageState>()(
  persist(
    (set, get) => ({
      connectedToHub: false,
      connectedToGithub: false,
      githubConfig: undefined,
      apiUrl: undefined,
      sessionToken: undefined,
      apiToken: undefined,
      hubUrl: undefined,
      setConnectedToHub: (connected: boolean) => set({ connectedToHub: connected }),
      setConnectedToGithub: (connected: boolean) => set({ connectedToGithub: connected }),
      setGithubConfig: (config?: GitHubConfig) => set({ githubConfig: config }),
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
      setAPIToken: (apiToken: string) => set({ apiToken }),

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
