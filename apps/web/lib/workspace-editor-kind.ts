export type WorkspaceEditorKind = 'text' | 'pdf' | 'image'

export const getWorkspaceEditorKind = (filePath: string): WorkspaceEditorKind => {
  const base = filePath.split('/').pop() ?? filePath
  const dot = base.lastIndexOf('.')

  if (dot === -1) {
    return 'text'
  }

  const ext = base.slice(dot).toLowerCase()

  if (ext === '.pdf') {
    return 'pdf'
  }

  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
  if (imageExtensions.includes(ext)) {
    return 'image'
  }

  return 'text'
}

export const getWorkspaceFileUrl = (relativePath: string) =>
  `/api/workspace/file?path=${encodeURIComponent(relativePath)}`
