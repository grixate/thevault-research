import { create } from "zustand";

export type Surface =
  | "dashboard"
  | "notes"
  | "sources"
  | "review"
  | "tasks"
  | "graph"
  | "capsules"
  | "assistant"
  | "learning"
  | "tools"
  | "settings";

type UIState = {
  surface: Surface;
  selectedNoteId?: string;
  selectedSourceId?: string;
  selectedSourceBlockId?: string;
  selectedReviewItemId?: string;
  selectedClaimId?: string;
  selectedCapsuleId?: string;
  quickNoteRequestId: number;
  sourceDialogRequestId: number;
  sourceDialogDraftText: string;
  setSurface: (surface: Surface) => void;
  setSelectedNoteId: (id?: string) => void;
  setSelectedSourceId: (id?: string) => void;
  setSelectedSourceBlockId: (id?: string) => void;
  setSelectedReviewItemId: (id?: string) => void;
  setSelectedClaimId: (id?: string) => void;
  setSelectedCapsuleId: (id?: string) => void;
  requestQuickNote: () => void;
  requestAddSource: (draftText?: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  surface: "dashboard",
  quickNoteRequestId: 0,
  sourceDialogRequestId: 0,
  sourceDialogDraftText: "",
  setSurface: (surface) => set({ surface }),
  setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
  setSelectedSourceId: (selectedSourceId) => set({ selectedSourceId }),
  setSelectedSourceBlockId: (selectedSourceBlockId) => set({ selectedSourceBlockId }),
  setSelectedReviewItemId: (selectedReviewItemId) => set({ selectedReviewItemId }),
  setSelectedClaimId: (selectedClaimId) => set({ selectedClaimId }),
  setSelectedCapsuleId: (selectedCapsuleId) => set({ selectedCapsuleId }),
  requestQuickNote: () => set((state) => ({ quickNoteRequestId: state.quickNoteRequestId + 1 })),
  requestAddSource: (draftText = "") => set((state) => ({ sourceDialogRequestId: state.sourceDialogRequestId + 1, sourceDialogDraftText: draftText }))
}));
