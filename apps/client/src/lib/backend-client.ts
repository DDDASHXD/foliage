import { normalizeServerUrl } from '@/lib/server-url'
import { useSessionStore } from '@/stores/session.store'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const isTauriRuntime = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export const getBackendBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  const override = useSessionStore.getState().serverUrl

  if (override) {
    return normalizeBaseUrl(override)
  }

  // Production Tauri serves the UI from asset:// — not a valid HTTP base for fetch/URL.
  if (isTauriRuntime()) {
    throw new Error('Local server URL is not ready yet.')
  }

  return window.location.origin
}

export const getBackendWebSocketBase = (): string => {
  const baseUrl = getBackendBaseUrl()

  if (baseUrl.startsWith('https://')) {
    return `wss://${baseUrl.slice('https://'.length).split('/')[0]}`
  }

  if (baseUrl.startsWith('http://')) {
    return `ws://${baseUrl.slice('http://'.length).split('/')[0]}`
  }

  throw new Error(`Unsupported backend base URL: ${baseUrl}`)
}

export const getCollaborationWsUrl = (): string => {
  return `${getBackendWebSocketBase()}/collaboration`
}

export const backendFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const url = path.startsWith('http') ? path : `${getBackendBaseUrl()}${path}`

  return fetch(url, init)
}

export const getWorkspaceFileUrl = (relativePath: string): string => {
  return `${getBackendBaseUrl()}/api/workspace/file?path=${encodeURIComponent(relativePath)}`
}

export const checkServerHealth = async (serverUrl: string): Promise<boolean> => {
  try {
    const { url } = normalizeServerUrl(serverUrl)
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}
