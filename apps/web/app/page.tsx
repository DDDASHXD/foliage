'use client'

import Sidebar from '@/components/sidebar/sidebar'
import { MonacoEditor } from '@/components/editor/monaco-editor'
import EditorTabs from '@/components/editor/tabs'
import Menubar from '@/components/menubar'
import Terminal from '@/components/terminal'
import { useApplicationStore } from '@/stores/application.store'
import Statusbar from '@/components/statusbar'

export default function Page() {
  const { terminalOpen } = useApplicationStore()
  return (
    <div className="w-screen h-screen flex flex-col">
      <Menubar />
      <div className="flex h-full min-h-0">
        <Sidebar />
        {/* content */}
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <EditorTabs />
          <MonacoEditor />
          {terminalOpen && <Terminal />}
        </div>
      </div>
      <Statusbar />
    </div>
  )
}
