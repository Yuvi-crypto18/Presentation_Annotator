import { create } from 'zustand';
import { Presentation, Slide, Tag } from '@shared/types';

interface PresentationStore {
  // Presentation data
  presentationId: string | null;
  presentationName: string;
  slides: Slide[];
  currentSlideIndex: number;
  annotations: Record<string, Tag[]>;
  
  // Actions
  setPresentationData: (presentation: Presentation, slides: Slide[]) => void;
  setAnnotations: (slideId: string, tags: Tag[]) => void;
  resetStore: () => void;
}

export const usePresentationStore = create<PresentationStore>((set) => ({
  // Initial state
  presentationId: null,
  presentationName: '',
  slides: [],
  currentSlideIndex: 0,
  annotations: {},
  
  // Actions
  setPresentationData: (presentation, slides) => set({
    presentationId: presentation.presentation_id,
    presentationName: presentation.name,
    slides,
  }),
  
  setAnnotations: (slideId, tags) => set((state) => ({
    annotations: {
      ...state.annotations,
      [slideId]: tags
    }
  })),
  
  resetStore: () => set({
    presentationId: null,
    presentationName: '',
    slides: [],
    currentSlideIndex: 0,
    annotations: {}
  })
}));
