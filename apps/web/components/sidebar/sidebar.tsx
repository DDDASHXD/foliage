'use client'

import { useFilesStore, type WorkspaceEntry } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'
import React from 'react'

type WorkspaceResponse = {
  root: {
    name: string
    path: string
  }
  entries: WorkspaceEntry[]
  error?: string
}

const getEntries = async (path: string) => {
  const response = await fetch(`/api/workspace?path=${encodeURIComponent(path)}`)
  const data = (await response.json()) as WorkspaceResponse

  if (!response.ok) {
    throw new Error(data.error ?? 'Unable to load workspace.')
  }

  return data
}

const DirectoryChildren = ({
  path,
  depth,
}: {
  path: string
  depth: number
}) => {
  const [entries, setEntries] = React.useState<WorkspaceEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const setActiveFile = useFilesStore((state) => state.setActiveFile)

  React.useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    void getEntries(path)
      .then((data) => {
        if (cancelled) {
          return
        }

        setEntries(data.entries)

        if (path === '' && !useFilesStore.getState().activeFile) {
          const firstFile = data.entries.find((entry) => entry.type === 'file')

          if (firstFile) {
            setActiveFile(firstFile.path)
          }
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) {
          return
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load folder.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [path, setActiveFile])

  if (loading) {
    return (
      <div className="text-muted-foreground px-2 py-1 text-xs" style={{ paddingLeft: depth * 14 + 8 }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive px-2 py-1 text-xs" style={{ paddingLeft: depth * 14 + 8 }}>
        {error}
      </div>
    )
  }

  return (
    <>
      {entries.map((entry) => (
        <TreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
        />
      ))}
    </>
  )
}

const TreeItem = ({
  entry,
  depth,
}: {
  entry: WorkspaceEntry
  depth: number
}) => {
  const [open, setOpen] = React.useState(false)
  const activeFile = useFilesStore((state) => state.activeFile)
  const setActiveFile = useFilesStore((state) => state.setActiveFile)
  const isDirectory = entry.type === 'directory'

  return (
    <>
      <button
        type="button"
        className={cn(
          'hover:bg-muted flex h-7 w-full items-center gap-1 truncate px-2 text-left text-sm',
          activeFile === entry.path && 'bg-muted text-foreground'
        )}
        style={{ paddingLeft: depth * 14 + 8 }}
        title={entry.path}
        onClick={() => {
          if (isDirectory) {
            setOpen((value) => !value)
          } else {
            setActiveFile(entry.path)
          }
        }}
      >
        <span className="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center text-xs">
          {isDirectory ? (open ? '⌄' : '›') : ''}
        </span>
        <span className={cn('truncate', isDirectory && 'text-foreground')}>
          {entry.name}
        </span>
      </button>
      {isDirectory && open && (
        <DirectoryChildren
          path={entry.path}
          depth={depth + 1}
        />
      )}
    </>
  )
}

const Sidebar = () => {
  const rootName = useFilesStore((state) => state.rootName)
  const setRootName = useFilesStore((state) => state.setRootName)

  React.useEffect(() => {
    let cancelled = false

    void getEntries('')
      .then((data) => {
        if (!cancelled) {
          setRootName(data.root.name)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [setRootName])

  return (
    <aside className="bg-sidebar text-sidebar-foreground h-full w-72 shrink-0 overflow-auto border-r">
      <div className="sticky top-0 z-10 border-b bg-sidebar px-2 py-2 text-sm font-medium">
        {rootName}
      </div>
      <DirectoryChildren
        path=""
        depth={0}
      />
    </aside>
  )
}

export default Sidebar
