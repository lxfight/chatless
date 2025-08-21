import { create } from 'zustand';

interface SchemaHelperState {
  selectedProvider?: string;
  selectedModelId?: string;
  setSelection: (provider: string, modelId: string) => void;
}

export const useSchemaHelperStore = create<SchemaHelperState>((set) => ({
  selectedProvider: undefined,
  selectedModelId: undefined,
  setSelection: (provider: string, modelId: string) => set({ selectedProvider: provider, selectedModelId: modelId }),
}));

