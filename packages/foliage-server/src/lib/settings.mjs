import fs from 'node:fs/promises'
import path from 'node:path'

export const defaultSettings = {
  theme: 'dark',
  editor: {
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 2,
    markdownPrettierFormat: false,
    markdownPrettierPrintWidth: 88,
    markdownPrettierDebounceMs: 2000,
    rulers: [],
  },
  workspace: {
    maxDirectoryEntries: 500,
    maxUploadBytes: 104857600,
    ignoredDirectories: ['.git', '.next', '.turbo', '.foliage'],
    showHiddenFiles: false,
  },
  leafmark: {
    projectFolder: 'project',
    buildOptions: {
      output: 'dist',
      outputFormat: 'pdf',
      html: false,
      htmlOnly: false,
      noMergeCover: false,
    },
  },
}

const mergeSettings = (parsed = {}) => {
  const merged = { ...defaultSettings, ...parsed }
  merged.editor = { ...defaultSettings.editor, ...(parsed.editor || {}) }
  merged.editor.minimap = {
    ...defaultSettings.editor.minimap,
    ...(parsed.editor?.minimap || {}),
  }
  merged.workspace = { ...defaultSettings.workspace, ...(parsed.workspace || {}) }
  merged.leafmark = {
    ...defaultSettings.leafmark,
    ...(parsed.leafmark || {}),
    buildOptions: {
      ...defaultSettings.leafmark.buildOptions,
      ...(parsed.leafmark?.buildOptions || {}),
    },
  }

  return merged
}

export const createSettingsHandlers = (workspaceRoot) => {
  const getSettingsPath = () => path.join(workspaceRoot, '.foliage', 'settings.json')

  const ensureFoliageFolder = async () => {
    const foliagePath = path.join(workspaceRoot, '.foliage')

    try {
      await fs.mkdir(foliagePath, { recursive: true })
    } catch {
      // Folder may already exist
    }
  }

  const loadSettings = async () => {
    const settingsPath = getSettingsPath()

    try {
      const content = await fs.readFile(settingsPath, 'utf8')
      return mergeSettings(JSON.parse(content))
    } catch {
      return mergeSettings({})
    }
  }

  const saveSettings = async (newSettings) => {
    await ensureFoliageFolder()
    const settingsPath = getSettingsPath()
    const existing = await loadSettings()
    const merged = mergeSettings({
      ...existing,
      ...newSettings,
      editor: { ...existing.editor, ...(newSettings.editor || {}) },
      workspace: { ...existing.workspace, ...(newSettings.workspace || {}) },
      leafmark: {
        ...existing.leafmark,
        ...(newSettings.leafmark || {}),
        buildOptions: {
          ...existing.leafmark?.buildOptions,
          ...(newSettings.leafmark?.buildOptions || {}),
        },
      },
    })

    await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2), 'utf8')
    return merged
  }

  return { ensureFoliageFolder, loadSettings, saveSettings }
}
