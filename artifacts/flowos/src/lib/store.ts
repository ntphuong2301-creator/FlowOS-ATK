import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Project } from '@workspace/api-client-react';

interface AppState {
  user: User | null;
  token: string | null;
  currentProject: Project | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setCurrentProject: (project: Project | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentProject: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null, currentProject: null }),
      setCurrentProject: (project) => set({ currentProject: project }),
    }),
    {
      name: 'flowos-storage',
    }
  )
);
