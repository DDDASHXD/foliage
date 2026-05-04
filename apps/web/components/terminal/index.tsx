'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import { RotateCcw, SquareTerminal, X } from 'lucide-react'

import { Button } from '@workspace/ui/components/button'

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'closed'

type ServerMessage =
  | { type: 'connected' }
  | { type: 'data'; data: string }
  | { type: 'exit'; code?: number; signal?: number }
  | { type: 'error'; message: string }

const Terminal = () => {
  const terminalElementRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const connected = connectionState === 'connected'

  const disconnect = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setConnectionState('closed')
  }, [])

  const connect = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    if (!terminal || !fitAddon) {
      return
    }

    socketRef.current?.close()
    terminal.clear()
    terminal.write('Starting local terminal...\r\n')
    setConnectionState('connecting')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${window.location.host}/terminal`)

    socketRef.current = socket

    socket.addEventListener('open', () => {
      fitAddon.fit()
      socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      terminal.focus()
    })

    socket.addEventListener('message', (messageEvent) => {
      let message: ServerMessage

      try {
        message = JSON.parse(messageEvent.data) as ServerMessage
      } catch {
        terminal.write('\r\nReceived an invalid terminal message.\r\n')
        return
      }

      if (message.type === 'connected') {
        setConnectionState('connected')
      }

      if (message.type === 'data') {
        terminal.write(message.data)
      }

      if (message.type === 'exit') {
        terminal.write(`\r\nTerminal exited with code ${message.code ?? 'unknown'}.\r\n`)
        setConnectionState('closed')
      }

      if (message.type === 'error') {
        terminal.write(`\r\n${message.message}\r\n`)
        setConnectionState('closed')
      }
    })

    socket.addEventListener('close', () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }

      setConnectionState((current) => (current === 'connected' ? 'closed' : current))
    })

    socket.addEventListener('error', () => {
      terminal.write('\r\nUnable to open the terminal connection.\r\n')
      setConnectionState('closed')
    })
  }, [])

  useEffect(() => {
    if (!terminalElementRef.current) {
      return
    }

    const terminalStyles = getComputedStyle(terminalElementRef.current)
    const background = terminalStyles.backgroundColor
    const foreground = terminalStyles.color

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'var(--font-terminal), var(--font-mono), monospace',
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background,
        foreground,
        cursor: foreground,
        selectionBackground: 'color-mix(in oklch, currentColor 22%, transparent)',
      },
    })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(terminalElementRef.current)
    fitAddon.fit()

    terminal.onData((data) => {
      socketRef.current?.send(JSON.stringify({ type: 'input', data }))
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = terminal
      socketRef.current?.send(JSON.stringify({ type: 'resize', cols, rows }))
    })

    resizeObserver.observe(terminalElementRef.current)
    const connectTimeout = window.setTimeout(connect, 0)

    return () => {
      window.clearTimeout(connectTimeout)
      resizeObserver.disconnect()
      socketRef.current?.close()
      terminal.dispose()
    }
  }, [connect])

  return (
    <section className="flex h-1/3 min-h-64 w-full flex-col border-t bg-background text-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-2 py-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <SquareTerminal className="size-3.5" aria-hidden="true" />
          Local Terminal
        </div>
        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {connectionState}
        </div>
        {connected ? (
          <Button type="button" variant="destructive" size="sm" onClick={disconnect}>
            <X aria-hidden="true" />
            Kill
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={connect}>
            <RotateCcw aria-hidden="true" />
            Restart
          </Button>
        )}
      </div>
      <div
        ref={terminalElementRef}
        className="min-h-0 flex-1 overflow-hidden bg-background p-2 text-foreground"
      />
    </section>
  )
}

export default Terminal
