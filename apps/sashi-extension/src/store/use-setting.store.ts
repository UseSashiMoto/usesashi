import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingState {
  accountId?: string;
  setAccountId: (accountId: string) => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      setAccountId: (accountId: string) => set({ accountId }),
    }),
    {
      name: 'setting-storage',
    }
  )
);
