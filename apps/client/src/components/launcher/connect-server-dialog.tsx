import React from 'react'
import { checkServerHealth } from '@/lib/backend-client'
import { normalizeServerUrl } from '@/lib/server-url'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

export type ConnectServerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (serverUrl: string, label: string) => void
}

export const ConnectServerDialog = ({
  open,
  onOpenChange,
  onConnect,
}: ConnectServerDialogProps) => {
  const [serverUrl, setServerUrl] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [hint, setHint] = React.useState<string | null>(null)
  const [connecting, setConnecting] = React.useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    setHint(null)

    try {
      const { url: normalized, hint: normalizedHint } = normalizeServerUrl(serverUrl)

      if (normalizedHint) {
        setHint(normalizedHint)
      }

      const healthy = await checkServerHealth(serverUrl)

      if (!healthy) {
        throw new Error(
          'Server is unreachable or not a foliage server. On this computer use 127.0.0.1:8787. From another device use <server-ip>:8787 (not 127.0.0.1 or 0.0.0.0).',
        )
      }

      const displayLabel = label.trim() || new URL(normalized).host
      onConnect(normalized, displayLabel)
      onOpenChange(false)
      setServerUrl('')
      setLabel('')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Connection failed.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to server</DialogTitle>
          <DialogDescription>
            Enter the address of a running foliage-server. HTTP is assumed unless you
            prefix https://. On this computer use 127.0.0.1:8787. From another device
            use &lt;server-ip&gt;:8787.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="server-url">Server address</Label>
            <Input
              id="server-url"
              placeholder="127.0.0.1:8787"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="server-label">Display name (optional)</Label>
            <Input
              id="server-label"
              placeholder="My team server"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleConnect()} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
