'use client'

import { MonacoEditor } from '@/components/editor/monaco-editor'
import { PdfViewer } from '@/components/editor/pdf-viewer'
import { getWorkspaceEditorKind } from '@/lib/workspace-editor-kind'
import { OPENMD_PATH_MIME, isTreeDirectoryDrag } from '@/lib/openmd-dnd'
import { useFilesStore } from '@/stores/files.store'
import React from 'react'
import { ImageViewer } from './image-viewer'

export type EditorPaneProps = {
  groupId: string
}

export const EditorPane = ({ groupId }: EditorPaneProps) => {
  const activeFile = useFilesStore((state) => state.groups[groupId]?.activeFile ?? null)
  const openFileInGroup = useFilesStore((state) => state.openFileInGroup)
  const kind = activeFile ? getWorkspaceEditorKind(activeFile) : null

  const handleDragOver = (event: React.DragEvent) => {
    if (![...event.dataTransfer.types].includes(OPENMD_PATH_MIME)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (isTreeDirectoryDrag(event.dataTransfer)) {
      return
    }
    const path = event.dataTransfer.getData(OPENMD_PATH_MIME)
    if (!path) {
      return
    }
    openFileInGroup(groupId, path)
  }

  const displayEditor = (activeFile: string) => {
    switch (kind) {
      case 'text':
        return <MonacoEditor groupId={groupId} />
      case 'pdf':
        return <PdfViewer path={activeFile} />
      case 'image':
        return <ImageViewer path={activeFile} />
      default:
        return null
    }
  }

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {!activeFile && (
        <div className="bg-background text-muted-foreground flex min-h-0 min-w-0 flex-1 items-center justify-center text-sm">
          Select a file
        </div>
      )}
      {activeFile && displayEditor(activeFile)}
    </div>
  )
}
