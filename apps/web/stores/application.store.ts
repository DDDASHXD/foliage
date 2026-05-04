import { create } from 'zustand'

interface ApplicationStore {
  terminalOpen: boolean
  setTerminalOpen: (terminalOpen: boolean) => void
}

export const useApplicationStore = create<ApplicationStore>()((set) => ({
  terminalOpen: false,
  setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
}))
