import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingState {
  accountId?: string;
  setAccountId: (accountId: string) => void;
  accountSignature?: string;
  setAccountSignature: (signature: string) => void;
  accountKey?: string;
  setAccountKey: (key: string) => void;
  serverAddress?: string;
  setServerAddress: (address: string) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      setAccountId: (accountId: string) => set({ accountId }),
      setAccountSignature: (signature: string) => set({ accountSignature: signature }),
      setAccountKey: (key: string) => set({ accountKey: key }),
      setServerAddress: (address: string) => set({ serverAddress: address }),
    }),
    {
      name: 'setting-storage',
    }
  )
);
