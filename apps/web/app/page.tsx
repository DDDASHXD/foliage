'use client'

import Sidebar from '@/components/sidebar/sidebar'
import { EditorLayoutRoot } from '@/components/editor/editor-layout-root'
import Menubar from '@/components/menubar'
import Terminal from '@/components/terminal'
import { useApplicationStore } from '@/stores/application.store'
import Statusbar from '@/components/statusbar'

export default function Page() {
  const { terminalOpen } = useApplicationStore()
  return (
    <div className="w-screen h-screen flex flex-col">
      <Menubar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar />
        {/* content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <EditorLayoutRoot />
          {terminalOpen && <Terminal />}
        </div>
      </div>
      <Statusbar />
    </div>
  )
}
