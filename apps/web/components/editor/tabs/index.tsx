'use client'

import React, { useState } from 'react'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useFilesStore } from '@/stores/files.store'
import { cn } from '@workspace/ui/lib/utils'

const EditorTabs = () => {
  const [activeTab, setActiveTab] = useState<number>(0)
  const collaborators = useCollaborationStore((state) => state.collaborators)
  const activeFile = useFilesStore((state) => state.activeFile)
  const tabs = activeFile
    ? [
        {
          id: 0,
          name: activeFile.split('/').at(-1) ?? activeFile,
        },
      ]
    : []

  return (
    <div className="flex flex-col border-b">
      <div className="bg-muted flex">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'px-4 py-2 cursor-default border-r border-b',
              activeTab === tab.id && 'bg-background text-foreground border-b-0',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </div>
        ))}
        <div className="empty w-full h-full border-b"></div>
      </div>
      {tabs
        .filter((tab) => tab.id !== activeTab)
        .map((tab) => (
          <div key={tab.id} className="px-4 py-2 pl-6 flex gap-2 items-center">
            <div className="avatars flex">
              {collaborators.slice(0, 3).map((collaborator) => (
                <div
                  key={collaborator.id}
                  className="size-9 bg-background rounded-full -ml-4 relative isolate p-1"
                  title={collaborator.name}
                >
                  <div
                    className="w-full h-full rounded-full border"
                    style={{ backgroundColor: collaborator.color }}
                  ></div>
                </div>
              ))}
            </div>
            <p className="text-xs">
              {collaborators.length === 1
                ? '1 person here'
                : `${collaborators.length} people here`}
            </p>
          </div>
        ))}
    </div>
  )
}

export default EditorTabs
