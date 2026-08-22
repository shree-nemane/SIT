import { create } from 'zustand';
import { Presence } from './types';

interface PresenceState {
  // Current user's local active presence
  myPresence: Presence | null;
  // UI editing draft
  draftDescription: string;
  draftImagePath: string | null;
  isSaving: boolean;
  
  // Actions
  setMyPresence: (presence: Presence | null) => void;
  setDraftDescription: (desc: string) => void;
  setDraftImagePath: (path: string | null) => void;
  setIsSaving: (isSaving: boolean) => void;
  resetDraft: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  myPresence: null,
  draftDescription: '',
  draftImagePath: null,
  isSaving: false,

  setMyPresence: (presence) => set({ myPresence: presence }),
  setDraftDescription: (desc) => set({ draftDescription: desc }),
  setDraftImagePath: (path) => set({ draftImagePath: path }),
  setIsSaving: (isSaving) => set({ isSaving }),
  resetDraft: () => set({ draftDescription: '', draftImagePath: null, isSaving: false }),
}));
