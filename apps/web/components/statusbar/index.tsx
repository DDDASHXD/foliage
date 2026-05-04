'use client'

import React from 'react'
import { useCollaborationStore } from '@/stores/collaboration.store'

const Statusbar = () => {
  const connectionStatus = useCollaborationStore(
    (state) => state.connectionStatus
  )

  return (
    <div className="w-full bg-secondary border-t px-2 py-1 text-xs">
      Websocket: <span className="capitalize">{connectionStatus}</span>
    </div>
  )
}

export default Statusbar
