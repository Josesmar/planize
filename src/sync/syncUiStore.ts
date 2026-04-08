import { create } from 'zustand'

export type SyncUiKind = 'disabled' | 'connecting' | 'synced' | 'error'

interface SyncUiState {
  kind: SyncUiKind
  message?: string
  lastAt?: number
  setSyncUi: (p: Partial<Pick<SyncUiState, 'kind' | 'message' | 'lastAt'>>) => void
  reset: () => void
}

export const useSyncUiStore = create<SyncUiState>((set) => ({
  kind: 'disabled',
  setSyncUi: (p) => set(p),
  reset: () => set({ kind: 'disabled', message: undefined, lastAt: undefined }),
}))
