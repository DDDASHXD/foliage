import { create } from 'zustand'

export type WorkspaceEntry = {
  name: string
  path: string
  type: 'directory' | 'file'
}

interface FilesStore {
  activeFile: string | null
  rootName: string
  setActiveFile: (activeFile: string | null) => void
  setRootName: (rootName: string) => void
}

export const useFilesStore = create<FilesStore>()((set) => ({
  activeFile: null,
  rootName: 'workspace',
  setActiveFile: (activeFile) => set({ activeFile }),
  setRootName: (rootName) => set({ rootName }),
}))
